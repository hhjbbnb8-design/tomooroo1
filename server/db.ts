import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  assignments,
  lessons,
  recordings,
  schools,
  sessions,
  submissions,
  users,
  type InsertUser,
} from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

async function db() {
  const instance = await getDb();
  if (!instance) throw new Error("قاعدة البيانات غير متاحة حالياً");
  return instance;
}

function insertedId(result: unknown): number {
  const raw = result as Array<{ insertId?: number }> | { insertId?: number };
  if (Array.isArray(raw)) return Number(raw[0]?.insertId ?? 0);
  return Number(raw?.insertId ?? 0);
}

/* ------------------------------- المدارس ------------------------------- */

export async function listSchools() {
  const d = await db();
  return d.select().from(schools).orderBy(schools.id);
}

export async function ensureSchool(name: string, slug: string) {
  const d = await db();
  const existing = await d.select().from(schools).where(eq(schools.slug, slug)).limit(1);
  if (existing[0]) return existing[0];
  await d.insert(schools).values({ name, slug });
  const created = await d.select().from(schools).where(eq(schools.slug, slug)).limit(1);
  return created[0];
}

/* ------------------------------- المستخدمون ------------------------------- */

export async function getUserById(id: number) {
  const d = await db();
  const rows = await d.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0];
}

export async function getUserByUsername(username: string) {
  const d = await db();
  const rows = await d.select().from(users).where(eq(users.username, username)).limit(1);
  return rows[0];
}

export async function createUser(data: InsertUser) {
  const d = await db();
  const result = await d.insert(users).values(data);
  return insertedId(result);
}

export async function listUsersByRole(role: "admin" | "teacher" | "student", schoolId?: number) {
  const d = await db();
  const where = schoolId
    ? and(eq(users.role, role), eq(users.schoolId, schoolId))
    : eq(users.role, role);
  return d.select().from(users).where(where).orderBy(desc(users.createdAt));
}

export async function listUsersByIds(ids: number[]) {
  if (ids.length === 0) return [];
  const d = await db();
  return d.select().from(users).where(inArray(users.id, ids));
}

export async function setUserActive(id: number, isActive: boolean) {
  const d = await db();
  await d.update(users).set({ isActive }).where(eq(users.id, id));
}

export async function updateUserPassword(id: number, passwordHash: string) {
  const d = await db();
  await d.update(users).set({ passwordHash }).where(eq(users.id, id));
}

export async function touchLastSignedIn(id: number) {
  const d = await db();
  await d.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, id));
}

/* ------------------------------- الجلسات ------------------------------- */

export async function createSession(tokenHash: string, userId: number, expiresAt: Date) {
  const d = await db();
  await d.insert(sessions).values({ tokenHash, userId, expiresAt });
}

export async function getUserBySessionHash(tokenHash: string) {
  const d = await db();
  const rows = await d
    .select({ user: users, session: sessions })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return rows[0];
}

export async function deleteSession(tokenHash: string) {
  const d = await db();
  await d.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
}

export async function deleteExpiredSessions() {
  const d = await db();
  await d.delete(sessions).where(sql`${sessions.expiresAt} < NOW()`);
}

/* ------------------------------- الحصص ------------------------------- */

export async function createLesson(data: {
  title: string;
  description?: string | null;
  teacherId: number;
  schoolId: number;
  scheduledAt: Date;
  durationMinutes: number;
  roomCode: string;
}) {
  const d = await db();
  const result = await d.insert(lessons).values(data);
  const id = insertedId(result);
  const rows = await d.select().from(lessons).where(eq(lessons.id, id)).limit(1);
  return rows[0];
}

export async function updateLesson(
  id: number,
  data: Partial<{
    title: string;
    description: string | null;
    scheduledAt: Date;
    durationMinutes: number;
    status: "scheduled" | "live" | "ended";
    startedAt: Date | null;
    endedAt: Date | null;
  }>
) {
  const d = await db();
  await d.update(lessons).set(data).where(eq(lessons.id, id));
}

export async function deleteLesson(id: number) {
  const d = await db();
  await d.delete(recordings).where(eq(recordings.lessonId, id));
  await d.delete(lessons).where(eq(lessons.id, id));
}

export async function getLessonById(id: number) {
  const d = await db();
  const rows = await d.select().from(lessons).where(eq(lessons.id, id)).limit(1);
  return rows[0];
}

export async function listLessonsByTeacher(teacherId: number) {
  const d = await db();
  return d
    .select()
    .from(lessons)
    .where(eq(lessons.teacherId, teacherId))
    .orderBy(desc(lessons.scheduledAt));
}

export async function listLessonsBySchool(schoolId: number) {
  const d = await db();
  return d
    .select()
    .from(lessons)
    .where(eq(lessons.schoolId, schoolId))
    .orderBy(desc(lessons.scheduledAt));
}

export async function listLessonsWithTeacherBySchool(schoolId: number) {
  const d = await db();
  return d
    .select({
      lesson: lessons,
      teacherName: users.name,
      recording: recordings,
    })
    .from(lessons)
    .innerJoin(users, eq(users.id, lessons.teacherId))
    .leftJoin(recordings, eq(recordings.lessonId, lessons.id))
    .where(eq(lessons.schoolId, schoolId))
    .orderBy(desc(lessons.scheduledAt));
}

export async function listLessonsWithTeacherByTeacher(teacherId: number) {
  const d = await db();
  return d
    .select({ lesson: lessons, recording: recordings })
    .from(lessons)
    .leftJoin(recordings, eq(recordings.lessonId, lessons.id))
    .where(eq(lessons.teacherId, teacherId))
    .orderBy(desc(lessons.scheduledAt));
}

export async function getLessonWithRecording(id: number) {
  const d = await db();
  const rows = await d
    .select({ lesson: lessons, recording: recordings, teacherName: users.name })
    .from(lessons)
    .innerJoin(users, eq(users.id, lessons.teacherId))
    .leftJoin(recordings, eq(recordings.lessonId, lessons.id))
    .where(eq(lessons.id, id))
    .limit(1);
  return rows[0];
}

/* ------------------------------- التسجيلات ------------------------------- */

export async function createRecording(lessonId: number) {
  const d = await db();
  const existing = await d
    .select()
    .from(recordings)
    .where(eq(recordings.lessonId, lessonId))
    .limit(1);
  if (existing[0]) return existing[0];
  await d.insert(recordings).values({ lessonId, status: "recording" });
  const rows = await d
    .select()
    .from(recordings)
    .where(eq(recordings.lessonId, lessonId))
    .limit(1);
  return rows[0];
}

export async function getRecordingByLesson(lessonId: number) {
  const d = await db();
  const rows = await d
    .select()
    .from(recordings)
    .where(eq(recordings.lessonId, lessonId))
    .limit(1);
  return rows[0];
}

export async function markRecordingReady(
  id: number,
  data: { storageKey: string; contentType: string; durationSec: number; sizeBytes: number }
) {
  const d = await db();
  await d
    .update(recordings)
    .set({ ...data, status: "ready", readyAt: new Date() })
    .where(eq(recordings.id, id));
}

export async function markRecordingProcessing(id: number) {
  const d = await db();
  await d.update(recordings).set({ status: "processing" }).where(eq(recordings.id, id));
}

export async function deleteRecordingRow(lessonId: number) {
  const d = await db();
  await d.delete(recordings).where(eq(recordings.lessonId, lessonId));
}

export async function listReadyRecordingsBySchool(schoolId: number) {
  const d = await db();
  return d
    .select({
      recording: recordings,
      lesson: lessons,
      teacherName: users.name,
    })
    .from(recordings)
    .innerJoin(lessons, eq(lessons.id, recordings.lessonId))
    .innerJoin(users, eq(users.id, lessons.teacherId))
    .where(and(eq(lessons.schoolId, schoolId), eq(recordings.status, "ready")))
    .orderBy(desc(lessons.scheduledAt));
}

/* ------------------------------- الواجبات ------------------------------- */

export async function createAssignment(data: {
  title: string;
  description?: string | null;
  teacherId: number;
  schoolId: number;
  lessonId?: number | null;
  dueAt: Date;
  maxGrade: number;
}) {
  const d = await db();
  const result = await d.insert(assignments).values(data);
  const id = insertedId(result);
  const rows = await d.select().from(assignments).where(eq(assignments.id, id)).limit(1);
  return rows[0];
}

export async function updateAssignment(
  id: number,
  data: Partial<{
    title: string;
    description: string | null;
    lessonId: number | null;
    dueAt: Date;
    maxGrade: number;
  }>
) {
  const d = await db();
  await d.update(assignments).set(data).where(eq(assignments.id, id));
}

export async function deleteAssignment(id: number) {
  const d = await db();
  await d.delete(submissions).where(eq(submissions.assignmentId, id));
  await d.delete(assignments).where(eq(assignments.id, id));
}

export async function getAssignmentById(id: number) {
  const d = await db();
  const rows = await d.select().from(assignments).where(eq(assignments.id, id)).limit(1);
  return rows[0];
}

export async function listAssignmentsByTeacher(teacherId: number) {
  const d = await db();
  return d
    .select({
      assignment: assignments,
      submissionCount: sql<number>`count(${submissions.id})`,
      gradedCount: sql<number>`sum(case when ${submissions.grade} is null then 0 else 1 end)`,
    })
    .from(assignments)
    .leftJoin(submissions, eq(submissions.assignmentId, assignments.id))
    .where(eq(assignments.teacherId, teacherId))
    .groupBy(assignments.id)
    .orderBy(desc(assignments.createdAt));
}

export async function listAssignmentsForStudent(schoolId: number, studentId: number) {
  const d = await db();
  return d
    .select({
      assignment: assignments,
      submission: submissions,
      teacherName: users.name,
    })
    .from(assignments)
    .innerJoin(users, eq(users.id, assignments.teacherId))
    .leftJoin(
      submissions,
      and(eq(submissions.assignmentId, assignments.id), eq(submissions.studentId, studentId))
    )
    .where(eq(assignments.schoolId, schoolId))
    .orderBy(desc(assignments.dueAt));
}

/* ------------------------------- التسليمات ------------------------------- */

export async function getSubmission(assignmentId: number, studentId: number) {
  const d = await db();
  const rows = await d
    .select()
    .from(submissions)
    .where(and(eq(submissions.assignmentId, assignmentId), eq(submissions.studentId, studentId)))
    .limit(1);
  return rows[0];
}

export async function getSubmissionWithAssignment(id: number) {
  const d = await db();
  const rows = await d
    .select({ submission: submissions, assignment: assignments })
    .from(submissions)
    .innerJoin(assignments, eq(assignments.id, submissions.assignmentId))
    .where(eq(submissions.id, id))
    .limit(1);
  return rows[0];
}

export async function listSubmissionsForAssignment(assignmentId: number) {
  const d = await db();
  return d
    .select({ submission: submissions, student: users })
    .from(submissions)
    .innerJoin(users, eq(users.id, submissions.studentId))
    .where(eq(submissions.assignmentId, assignmentId))
    .orderBy(desc(submissions.submittedAt));
}

export async function upsertSubmission(data: {
  assignmentId: number;
  studentId: number;
  content: string | null;
  fileKey: string | null;
  fileName: string | null;
}) {
  const d = await db();
  const existing = await getSubmission(data.assignmentId, data.studentId);
  if (existing) {
    await d
      .update(submissions)
      .set({
        content: data.content,
        fileKey: data.fileKey,
        fileName: data.fileName,
        submittedAt: new Date(),
      })
      .where(eq(submissions.id, existing.id));
    return existing.id;
  }
  const result = await d.insert(submissions).values(data);
  return insertedId(result);
}

export async function gradeSubmission(id: number, grade: number, feedback: string | null) {
  const d = await db();
  await d
    .update(submissions)
    .set({ grade, feedback, gradedAt: new Date() })
    .where(eq(submissions.id, id));
}

export async function listSubmissionsByStudent(studentId: number) {
  const d = await db();
  return d
    .select({ submission: submissions, assignment: assignments })
    .from(submissions)
    .innerJoin(assignments, eq(assignments.id, submissions.assignmentId))
    .where(eq(submissions.studentId, studentId))
    .orderBy(desc(submissions.submittedAt));
}

/* ------------------------------- إحصاءات ------------------------------- */

export async function countUsers(role: "admin" | "teacher" | "student") {
  const d = await db();
  const rows = await d
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(eq(users.role, role));
  return Number(rows[0]?.count ?? 0);
}

export async function countPendingGrading(teacherId: number) {
  const d = await db();
  const rows = await d
    .select({ count: sql<number>`count(*)` })
    .from(submissions)
    .innerJoin(assignments, eq(assignments.id, submissions.assignmentId))
    .where(and(eq(assignments.teacherId, teacherId), sql`${submissions.grade} is null`));
  return Number(rows[0]?.count ?? 0);
}

export async function countReadyRecordingsByTeacher(teacherId: number) {
  const d = await db();
  const rows = await d
    .select({ count: sql<number>`count(*)` })
    .from(recordings)
    .innerJoin(lessons, eq(lessons.id, recordings.lessonId))
    .where(and(eq(lessons.teacherId, teacherId), eq(recordings.status, "ready")));
  return Number(rows[0]?.count ?? 0);
}
