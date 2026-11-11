import { nanoid } from "nanoid";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createAssignment,
  createLesson,
  createUser,
  countPendingGrading,
  countReadyRecordingsByTeacher,
  countUsers,
  deleteAssignment,
  deleteLesson,
  getAssignmentById,
  getLessonById,
  getLessonWithRecording,
  getSubmission,
  getSubmissionWithAssignment,
  getUserById,
  getUserByUsername,
  gradeSubmission,
  listAssignmentsByTeacher,
  listAssignmentsForStudent,
  listLessonsWithTeacherBySchool,
  listLessonsWithTeacherByTeacher,
  listReadyRecordingsBySchool,
  listSchools,
  listSubmissionsByStudent,
  listSubmissionsForAssignment,
  listUsersByRole,
  setUserActive,
  touchLastSignedIn,
  updateAssignment,
  updateLesson,
  updateUserPassword,
  upsertSubmission,
} from "./db";
import {
  clearSessionCookie,
  hashPassword,
  issueSession,
  publicUser,
  revokeRequestSession,
  setSessionCookie,
  verifyPassword,
} from "./auth";
import { endLiveLesson, startLiveLesson } from "./live";
import { adminProcedure, publicProcedure, router, studentProcedure, teacherProcedure } from "./_core/trpc";

const usernameSchema = z
  .string()
  .trim()
  .min(3, "اسم المستخدم يجب أن يكون 3 أحرف على الأقل")
  .max(32, "اسم المستخدم طويل جداً")
  .regex(/^[a-zA-Z0-9_.-]+$/, "اسم المستخدم يقبل الحروف الإنجليزية والأرقام فقط");

const passwordSchema = z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل").max(128);

const isoDateSchema = z
  .string()
  .min(1, "التاريخ مطلوب")
  .refine(value => !Number.isNaN(new Date(value).getTime()), "التاريخ غير صالح");

const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function checkLoginRate(key: string) {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || entry.resetAt < now) {
    loginAttempts.set(key, { count: 1, resetAt: now + 5 * 60 * 1000 });
    return;
  }
  entry.count += 1;
  if (entry.count > 10) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "محاولات كثيرة، انتظر دقائق ثم حاول مرة أخرى",
    });
  }
}

function requireSchool(schoolId: number | null, role: string) {
  if (!schoolId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: role === "teacher" ? "حسابك غير مرتبط بمدرسة" : "حسابك غير مرتبط بمدرسة",
    });
  }
  return schoolId;
}

async function getSchoolName(schoolId: number | null | undefined) {
  if (!schoolId) return null;
  const schools = await listSchools();
  return schools.find(school => school.id === schoolId)?.name ?? null;
}

const lessonSummary = (
  lesson: {
    id: number;
    title: string;
    description: string | null;
    scheduledAt: Date;
    durationMinutes: number;
    status: "scheduled" | "live" | "ended";
    schoolId: number;
    teacherId: number;
    startedAt: Date | null;
    endedAt: Date | null;
  },
  recording?: {
    status: string;
    storageKey: string | null;
    durationSec?: number;
    sizeBytes?: number;
  } | null
) => ({
  id: lesson.id,
  title: lesson.title,
  description: lesson.description,
  scheduledAt: lesson.scheduledAt,
  durationMinutes: lesson.durationMinutes,
  status: lesson.status,
  schoolId: lesson.schoolId,
  teacherId: lesson.teacherId,
  startedAt: lesson.startedAt,
  endedAt: lesson.endedAt,
  recording:
    recording?.status === "ready"
      ? {
          status: "ready",
          url: `/manus-storage/${recording.storageKey}`,
          durationSec: recording.durationSec ?? 0,
          sizeBytes: recording.sizeBytes ?? 0,
        }
      : recording
        ? { status: recording.status }
        : null,
});

export const appRouter = router({
  auth: router({
    schools: publicProcedure.query(async () => listSchools()),

    me: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.user) return null;
      const schoolName = await getSchoolName(ctx.user.schoolId);
      return { ...publicUser(ctx.user), schoolName };
    }),

    login: publicProcedure
      .input(z.object({ username: z.string().trim().min(1), password: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        const username = input.username.toLowerCase();
        checkLoginRate(`${username}:${ctx.req.ip}`);
        const user = await getUserByUsername(username);
        const valid = user ? await verifyPassword(input.password, user.passwordHash) : false;
        if (!user || !valid) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "اسم المستخدم أو كلمة المرور غير صحيحة",
          });
        }
        if (!user.isActive) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "هذا الحساب معطّل، تواصل مع المسؤول",
          });
        }
        const { token, expiresAt } = await issueSession(user.id);
        setSessionCookie(ctx.res, token, expiresAt);
        await touchLastSignedIn(user.id);
        loginAttempts.delete(`${username}:${ctx.req.ip}`);
        return {
          token,
          user: { ...publicUser(user), schoolName: await getSchoolName(user.schoolId) },
        };
      }),

    logout: publicProcedure.mutation(async ({ ctx }) => {
      await revokeRequestSession(ctx.req);
      clearSessionCookie(ctx.res);
      return { success: true };
    }),

    changePassword: publicProcedure
      .input(
        z.object({
          currentPassword: z.string().min(1, "أدخل كلمة المرور الحالية"),
          newPassword: passwordSchema,
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: "يجب تسجيل الدخول" });
        const user = await getUserByUsername(ctx.user.username);
        if (!user || !(await verifyPassword(input.currentPassword, user.passwordHash))) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "كلمة المرور الحالية غير صحيحة" });
        }
        await updateUserPassword(user.id, await hashPassword(input.newPassword));
        return { success: true };
      }),
  }),

  admin: router({
    overview: adminProcedure.query(async () => {
      const [students, teachers, schools, allStudents] = await Promise.all([
        countUsers("student"),
        countUsers("teacher"),
        listSchools(),
        listUsersByRole("student"),
      ]);
      const activeStudents = allStudents.filter(student => student.isActive).length;
      return { students, teachers, schools: schools.length, activeStudents, schoolList: schools };
    }),

    listStudents: adminProcedure
      .input(z.object({ schoolId: z.number().int().positive().optional(), search: z.string().optional() }).optional())
      .query(async ({ input }) => {
        const schools = await listSchools();
        const students = await listUsersByRole("student", input?.schoolId);
        const search = input?.search?.trim().toLowerCase();
        const filtered = search
          ? students.filter(
              student =>
                student.name.toLowerCase().includes(search) ||
                student.username.toLowerCase().includes(search)
            )
          : students;
        return filtered.map(student => ({
          id: student.id,
          name: student.name,
          username: student.username,
          schoolId: student.schoolId,
          schoolName: schools.find(school => school.id === student.schoolId)?.name ?? "—",
          isActive: student.isActive,
          createdAt: student.createdAt,
          lastSignedIn: student.lastSignedIn,
        }));
      }),

    createStudent: adminProcedure
      .input(
        z.object({
          name: z.string().trim().min(2, "اسم الطالب قصير جداً").max(120),
          username: usernameSchema,
          password: passwordSchema,
          schoolId: z.number().int().positive("اختر المدرسة"),
        })
      )
      .mutation(async ({ input }) => {
        const schools = await listSchools();
        if (!schools.some(school => school.id === input.schoolId)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "المدرسة غير موجودة" });
        }
        const username = input.username.toLowerCase();
        if (await getUserByUsername(username)) {
          throw new TRPCError({ code: "CONFLICT", message: "اسم المستخدم مستخدم بالفعل" });
        }
        const id = await createUser({
          name: input.name,
          username,
          passwordHash: await hashPassword(input.password),
          role: "student",
          schoolId: input.schoolId,
          isActive: true,
        });
        return { id };
      }),

    createTeacher: adminProcedure
      .input(
        z.object({
          name: z.string().trim().min(2, "Teacher name is too short").max(120),
          username: usernameSchema,
          password: passwordSchema,
          schoolId: z.number().int().positive("Select a school"),
        })
      )
      .mutation(async ({ input }) => {
        const schools = await listSchools();
        if (!schools.some(school => school.id === input.schoolId)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "School not found" });
        }
        const username = input.username.toLowerCase();
        if (await getUserByUsername(username)) {
          throw new TRPCError({ code: "CONFLICT", message: "Username is already in use" });
        }
        const id = await createUser({
          name: input.name,
          username,
          passwordHash: await hashPassword(input.password),
          role: "teacher",
          schoolId: input.schoolId,
          isActive: true,
        });
        return { id };
      }),

    resetStudentPassword: adminProcedure
      .input(z.object({ studentId: z.number().int().positive(), password: passwordSchema }))
      .mutation(async ({ input }) => {
        const students = await listUsersByRole("student");
        if (!students.some(student => student.id === input.studentId)) {
          throw new TRPCError({ code: "NOT_FOUND", message: "الطالب غير موجود" });
        }
        await updateUserPassword(input.studentId, await hashPassword(input.password));
        return { success: true };
      }),

    setStudentActive: adminProcedure
      .input(z.object({ studentId: z.number().int().positive(), isActive: z.boolean() }))
      .mutation(async ({ input }) => {
        const students = await listUsersByRole("student");
        if (!students.some(student => student.id === input.studentId)) {
          throw new TRPCError({ code: "NOT_FOUND", message: "الطالب غير موجود" });
        }
        await setUserActive(input.studentId, input.isActive);
        return { success: true };
      }),

    listTeachers: adminProcedure.query(async () => {
      const [teachers, schools] = await Promise.all([listUsersByRole("teacher"), listSchools()]);
      return teachers.map(teacher => ({
        id: teacher.id,
        name: teacher.name,
        username: teacher.username,
        schoolName: schools.find(school => school.id === teacher.schoolId)?.name ?? "—",
        isActive: teacher.isActive,
      }));
    }),
  }),

  teacher: router({
    overview: teacherProcedure.query(async ({ ctx }) => {
      const schoolId = requireSchool(ctx.user.schoolId, "teacher");
      const [lessonRows, assignmentRows, pendingGrading, recordingsReady, students] = await Promise.all([
        listLessonsWithTeacherByTeacher(ctx.user.id),
        listAssignmentsByTeacher(ctx.user.id),
        countPendingGrading(ctx.user.id),
        countReadyRecordingsByTeacher(ctx.user.id),
        listUsersByRole("student", schoolId),
      ]);
      const now = Date.now();
      const live = lessonRows.find(row => row.lesson.status === "live");
      const scheduled = lessonRows
        .filter(row => row.lesson.status === "scheduled")
        .sort((a, b) => a.lesson.scheduledAt.getTime() - b.lesson.scheduledAt.getTime());
      const upcoming = scheduled.slice(0, 5).map(row => lessonSummary(row.lesson, row.recording));
      return {
        schoolName: await getSchoolName(schoolId),
        liveLesson: live ? lessonSummary(live.lesson, live.recording) : null,
        upcoming,
        upcomingCount: scheduled.length,
        assignmentsCount: assignmentRows.length,
        pendingGrading,
        recordingsReady,
        studentsCount: students.filter(student => student.isActive).length,
        recentAssignments: assignmentRows.slice(0, 4).map(row => ({
          id: row.assignment.id,
          title: row.assignment.title,
          dueAt: row.assignment.dueAt,
          submissionCount: Number(row.submissionCount ?? 0),
          gradedCount: Number(row.gradedCount ?? 0),
          overdue: row.assignment.dueAt.getTime() < now,
        })),
      };
    }),

    lessons: router({
      list: teacherProcedure.query(async ({ ctx }) => {
        const rows = await listLessonsWithTeacherByTeacher(ctx.user.id);
        return rows.map(row => lessonSummary(row.lesson, row.recording));
      }),

      get: teacherProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .query(async ({ input, ctx }) => {
          const row = await getLessonWithRecording(input.id);
          if (!row || row.lesson.teacherId !== ctx.user.id) {
            throw new TRPCError({ code: "NOT_FOUND", message: "الحصة غير موجودة" });
          }
          return {
            ...lessonSummary(row.lesson, row.recording),
            teacherName: row.teacherName,
            schoolName: await getSchoolName(row.lesson.schoolId),
          };
        }),

      create: teacherProcedure
        .input(
          z.object({
            title: z.string().trim().min(3, "عنوان الحصة قصير جداً").max(200),
            description: z.string().max(2000).optional().nullable(),
            scheduledAt: isoDateSchema,
            durationMinutes: z.number().int().min(15).max(300),
          })
        )
        .mutation(async ({ input, ctx }) => {
          const schoolId = requireSchool(ctx.user.schoolId, "teacher");
          const lesson = await createLesson({
            title: input.title,
            description: input.description?.trim() || null,
            teacherId: ctx.user.id,
            schoolId,
            scheduledAt: new Date(input.scheduledAt),
            durationMinutes: input.durationMinutes,
            roomCode: nanoid(12),
          });
          return lessonSummary(lesson);
        }),

      update: teacherProcedure
        .input(
          z.object({
            id: z.number().int().positive(),
            title: z.string().trim().min(3).max(200),
            description: z.string().max(2000).optional().nullable(),
            scheduledAt: isoDateSchema,
            durationMinutes: z.number().int().min(15).max(300),
          })
        )
        .mutation(async ({ input, ctx }) => {
          const lesson = await getLessonById(input.id);
          if (!lesson || lesson.teacherId !== ctx.user.id) {
            throw new TRPCError({ code: "NOT_FOUND", message: "الحصة غير موجودة" });
          }
          if (lesson.status === "live") {
            throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن تعديل حصة جارية" });
          }
          await updateLesson(input.id, {
            title: input.title,
            description: input.description?.trim() || null,
            scheduledAt: new Date(input.scheduledAt),
            durationMinutes: input.durationMinutes,
          });
          return { success: true };
        }),

      delete: teacherProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ input, ctx }) => {
          const lesson = await getLessonById(input.id);
          if (!lesson || lesson.teacherId !== ctx.user.id) {
            throw new TRPCError({ code: "NOT_FOUND", message: "الحصة غير موجودة" });
          }
          if (lesson.status === "live") {
            throw new TRPCError({ code: "BAD_REQUEST", message: "أنهِ الحصة الجارية أولاً" });
          }
          await deleteLesson(input.id);
          return { success: true };
        }),

      start: teacherProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ input, ctx }) => {
          try {
            const result = await startLiveLesson(input.id, ctx.user.id);
            return {
              lesson: result.lesson ? lessonSummary(result.lesson) : null,
              recordingId: result.recording?.id ?? null,
            };
          } catch (error) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: error instanceof Error ? error.message : "تعذر بدء الحصة",
            });
          }
        }),

      end: teacherProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ input, ctx }) => {
          const lesson = await getLessonById(input.id);
          if (!lesson || lesson.teacherId !== ctx.user.id) {
            throw new TRPCError({ code: "NOT_FOUND", message: "الحصة غير موجودة" });
          }
          await endLiveLesson(input.id);
          return { success: true };
        }),
    }),

    recordings: router({
      list: teacherProcedure.query(async ({ ctx }) => {
        const schoolId = requireSchool(ctx.user.schoolId, "teacher");
        const rows = await listReadyRecordingsBySchool(schoolId);
        return rows
          .filter(row => row.lesson.teacherId === ctx.user.id)
          .map(row => ({
            id: row.recording.id,
            lessonId: row.lesson.id,
            title: row.lesson.title,
            scheduledAt: row.lesson.scheduledAt,
            durationSec: row.recording.durationSec,
            sizeBytes: row.recording.sizeBytes,
            url: `/manus-storage/${row.recording.storageKey}`,
          }));
      }),
    }),

    assignments: router({
      list: teacherProcedure.query(async ({ ctx }) => {
        const rows = await listAssignmentsByTeacher(ctx.user.id);
        return rows.map(row => ({
          id: row.assignment.id,
          title: row.assignment.title,
          description: row.assignment.description,
          dueAt: row.assignment.dueAt,
          maxGrade: row.assignment.maxGrade,
          createdAt: row.assignment.createdAt,
          submissionCount: Number(row.submissionCount ?? 0),
          gradedCount: Number(row.gradedCount ?? 0),
        }));
      }),

      get: teacherProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .query(async ({ input, ctx }) => {
          const assignment = await getAssignmentById(input.id);
          if (!assignment || assignment.teacherId !== ctx.user.id) {
            throw new TRPCError({ code: "NOT_FOUND", message: "الواجب غير موجود" });
          }
          const [submissionRows, students] = await Promise.all([
            listSubmissionsForAssignment(input.id),
            listUsersByRole("student", assignment.schoolId),
          ]);
          const submittedIds = new Set(submissionRows.map(row => row.student.id));
          return {
            assignment: {
              id: assignment.id,
              title: assignment.title,
              description: assignment.description,
              dueAt: assignment.dueAt,
              maxGrade: assignment.maxGrade,
              lessonId: assignment.lessonId,
            },
            submissions: submissionRows.map(row => ({
              id: row.submission.id,
              studentId: row.student.id,
              studentName: row.student.name,
              studentUsername: row.student.username,
              content: row.submission.content,
              fileName: row.submission.fileName,
              fileUrl: row.submission.fileKey ? `/manus-storage/${row.submission.fileKey}` : null,
              grade: row.submission.grade,
              feedback: row.submission.feedback,
              submittedAt: row.submission.submittedAt,
              gradedAt: row.submission.gradedAt,
            })),
            notSubmitted: students
              .filter(student => !submittedIds.has(student.id))
              .map(student => ({ id: student.id, name: student.name, username: student.username })),
          };
        }),

      create: teacherProcedure
        .input(
          z.object({
            title: z.string().trim().min(3, "عنوان الواجب قصير جداً").max(200),
            description: z.string().max(4000).optional().nullable(),
            dueAt: isoDateSchema,
            maxGrade: z.number().int().min(1).max(1000),
            lessonId: z.number().int().positive().optional().nullable(),
          })
        )
        .mutation(async ({ input, ctx }) => {
          const schoolId = requireSchool(ctx.user.schoolId, "teacher");
          const assignment = await createAssignment({
            title: input.title,
            description: input.description?.trim() || null,
            teacherId: ctx.user.id,
            schoolId,
            lessonId: input.lessonId ?? null,
            dueAt: new Date(input.dueAt),
            maxGrade: input.maxGrade,
          });
          return { id: assignment.id };
        }),

      update: teacherProcedure
        .input(
          z.object({
            id: z.number().int().positive(),
            title: z.string().trim().min(3).max(200),
            description: z.string().max(4000).optional().nullable(),
            dueAt: isoDateSchema,
            maxGrade: z.number().int().min(1).max(1000),
          })
        )
        .mutation(async ({ input, ctx }) => {
          const assignment = await getAssignmentById(input.id);
          if (!assignment || assignment.teacherId !== ctx.user.id) {
            throw new TRPCError({ code: "NOT_FOUND", message: "الواجب غير موجود" });
          }
          await updateAssignment(input.id, {
            title: input.title,
            description: input.description?.trim() || null,
            dueAt: new Date(input.dueAt),
            maxGrade: input.maxGrade,
          });
          return { success: true };
        }),

      delete: teacherProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ input, ctx }) => {
          const assignment = await getAssignmentById(input.id);
          if (!assignment || assignment.teacherId !== ctx.user.id) {
            throw new TRPCError({ code: "NOT_FOUND", message: "الواجب غير موجود" });
          }
          await deleteAssignment(input.id);
          return { success: true };
        }),
    }),

    submissions: router({
      grade: teacherProcedure
        .input(
          z.object({
            submissionId: z.number().int().positive(),
            grade: z.number().int().min(0),
            feedback: z.string().max(2000).optional().nullable(),
          })
        )
        .mutation(async ({ input, ctx }) => {
          const row = await getSubmissionWithAssignment(input.submissionId);
          if (!row || row.assignment.teacherId !== ctx.user.id) {
            throw new TRPCError({ code: "NOT_FOUND", message: "التسليم غير موجود" });
          }
          if (input.grade > row.assignment.maxGrade) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `الدرجة القصوى لهذا الواجب ${row.assignment.maxGrade}`,
            });
          }
          await gradeSubmission(input.submissionId, input.grade, input.feedback?.trim() || null);
          return { success: true };
        }),
    }),
  }),

  student: router({
    overview: studentProcedure.query(async ({ ctx }) => {
      const schoolId = requireSchool(ctx.user.schoolId, "student");
      const [lessons, assignments, grades] = await Promise.all([
        listLessonsWithTeacherBySchool(schoolId),
        listAssignmentsForStudent(schoolId, ctx.user.id),
        listSubmissionsByStudent(ctx.user.id),
      ]);
      const now = Date.now();
      const live = lessons.find(row => row.lesson.status === "live");
      const upcoming = lessons
        .filter(row => row.lesson.status === "scheduled")
        .sort((a, b) => a.lesson.scheduledAt.getTime() - b.lesson.scheduledAt.getTime())
        .slice(0, 5)
        .map(row => ({ ...lessonSummary(row.lesson, row.recording), teacherName: row.teacherName }));
      const pending = assignments.filter(row => !row.submission && row.assignment.dueAt.getTime() > now);
      const graded = grades.filter(row => row.submission.grade !== null);
      const average =
        graded.length > 0
          ? Math.round(
              graded.reduce(
                (sum, row) => sum + ((row.submission.grade ?? 0) / row.assignment.maxGrade) * 100,
                0
              ) / graded.length
            )
          : null;
      return {
        schoolName: await getSchoolName(schoolId),
        liveLesson: live ? { ...lessonSummary(live.lesson, live.recording), teacherName: live.teacherName } : null,
        upcoming,
        pendingCount: pending.length,
        pending: pending.slice(0, 4).map(row => ({
          id: row.assignment.id,
          title: row.assignment.title,
          dueAt: row.assignment.dueAt,
          teacherName: row.teacherName,
        })),
        average,
        gradedCount: graded.length,
      };
    }),

    lessons: router({
      list: studentProcedure.query(async ({ ctx }) => {
        const schoolId = requireSchool(ctx.user.schoolId, "student");
        const rows = await listLessonsWithTeacherBySchool(schoolId);
        return rows.map(row => ({
          ...lessonSummary(row.lesson, row.recording),
          teacherName: row.teacherName,
        }));
      }),

      get: studentProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .query(async ({ input, ctx }) => {
          const schoolId = requireSchool(ctx.user.schoolId, "student");
          const row = await getLessonWithRecording(input.id);
          if (!row || row.lesson.schoolId !== schoolId) {
            throw new TRPCError({ code: "NOT_FOUND", message: "الحصة غير موجودة" });
          }
          return {
            ...lessonSummary(row.lesson, row.recording),
            teacherName: row.teacherName,
            schoolName: await getSchoolName(row.lesson.schoolId),
          };
        }),
    }),

    assignments: router({
      list: studentProcedure.query(async ({ ctx }) => {
        const schoolId = requireSchool(ctx.user.schoolId, "student");
        const rows = await listAssignmentsForStudent(schoolId, ctx.user.id);
        return rows.map(row => ({
          id: row.assignment.id,
          title: row.assignment.title,
          dueAt: row.assignment.dueAt,
          maxGrade: row.assignment.maxGrade,
          teacherName: row.teacherName,
          status: row.submission
            ? row.submission.grade !== null
              ? "graded"
              : "submitted"
            : row.assignment.dueAt.getTime() < Date.now()
              ? "missed"
              : "pending",
          grade: row.submission?.grade ?? null,
        }));
      }),

      get: studentProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .query(async ({ input, ctx }) => {
          const schoolId = requireSchool(ctx.user.schoolId, "student");
          const assignment = await getAssignmentById(input.id);
          if (!assignment || assignment.schoolId !== schoolId) {
            throw new TRPCError({ code: "NOT_FOUND", message: "الواجب غير موجود" });
          }
          const submission = await getSubmission(input.id, ctx.user.id);
          return {
            assignment: {
              id: assignment.id,
              title: assignment.title,
              description: assignment.description,
              dueAt: assignment.dueAt,
              maxGrade: assignment.maxGrade,
              teacherId: assignment.teacherId,
            },
            teacherName: (await getUserById(assignment.teacherId))?.name ?? "المعلم",
            submission: submission
              ? {
                  id: submission.id,
                  content: submission.content,
                  fileName: submission.fileName,
                  fileUrl: submission.fileKey ? `/manus-storage/${submission.fileKey}` : null,
                  grade: submission.grade,
                  feedback: submission.feedback,
                  submittedAt: submission.submittedAt,
                  gradedAt: submission.gradedAt,
                }
              : null,
            canSubmit: assignment.dueAt.getTime() > Date.now() && submission?.grade == null,
          };
        }),

      submit: studentProcedure
        .input(
          z.object({
            assignmentId: z.number().int().positive(),
            content: z.string().max(5000).optional().nullable(),
            fileKey: z.string().max(512).optional().nullable(),
            fileName: z.string().max(255).optional().nullable(),
          })
        )
        .mutation(async ({ input, ctx }) => {
          const schoolId = requireSchool(ctx.user.schoolId, "student");
          const assignment = await getAssignmentById(input.assignmentId);
          if (!assignment || assignment.schoolId !== schoolId) {
            throw new TRPCError({ code: "NOT_FOUND", message: "الواجب غير موجود" });
          }
          if (assignment.dueAt.getTime() <= Date.now()) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "انتهى وقت تسليم هذا الواجب" });
          }
          const existing = await getSubmission(input.assignmentId, ctx.user.id);
          if (existing?.grade !== null && existing?.grade !== undefined) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "تم تقييم واجبك ولا يمكن تعديل التسليم" });
          }
          const content = input.content?.trim() || null;
          const fileKey = input.fileKey?.trim() || null;
          if (!content && !fileKey) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "أضف نصاً أو ملفاً قبل التسليم" });
          }
          if (fileKey && !fileKey.startsWith(`uploads/${ctx.user.id}/`)) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "الملف المرفق غير صالح" });
          }
          await upsertSubmission({
            assignmentId: input.assignmentId,
            studentId: ctx.user.id,
            content,
            fileKey,
            fileName: input.fileName?.trim() || null,
          });
          return { success: true };
        }),
    }),

    submissions: router({
      mine: studentProcedure.query(async ({ ctx }) => {
        const rows = await listSubmissionsByStudent(ctx.user.id);
        return rows.map(row => ({
          id: row.submission.id,
          assignmentId: row.assignment.id,
          assignmentTitle: row.assignment.title,
          grade: row.submission.grade,
          maxGrade: row.assignment.maxGrade,
          feedback: row.submission.feedback,
          submittedAt: row.submission.submittedAt,
        }));
      }),
    }),
  }),

  system: router({
    health: publicProcedure.query(() => ({ ok: true })),
  }),
});

export type AppRouter = typeof appRouter;
