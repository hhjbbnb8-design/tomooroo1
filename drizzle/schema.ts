import {
  boolean,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/** المدرسة */
export const schools = mysqlTable("schools", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull().unique(),
  slug: varchar("slug", { length: 60 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type School = typeof schools.$inferSelect;

/** حسابات المنصة: مسؤول / معلم / طالب */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  role: mysqlEnum("role", ["admin", "teacher", "student"]).default("student").notNull(),
  schoolId: int("schoolId"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn"),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/** جلسات الدخول (يُخزن هاش التوكن فقط) */
export const sessions = mysqlTable("sessions", {
  id: int("id").autoincrement().primaryKey(),
  tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
});

/** الحصص (القادمة / المباشرة / المنتهية) */
export const lessons = mysqlTable("lessons", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  teacherId: int("teacherId").notNull(),
  schoolId: int("schoolId").notNull(),
  scheduledAt: timestamp("scheduledAt").notNull(),
  durationMinutes: int("durationMinutes").default(60).notNull(),
  status: mysqlEnum("status", ["scheduled", "live", "ended"]).default("scheduled").notNull(),
  roomCode: varchar("roomCode", { length: 32 }).notNull().unique(),
  startedAt: timestamp("startedAt"),
  endedAt: timestamp("endedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Lesson = typeof lessons.$inferSelect;

/** تسجيل كل حصة يُحفظ في التخزين السحابي بعد انتهائها */
export const recordings = mysqlTable("recordings", {
  id: int("id").autoincrement().primaryKey(),
  lessonId: int("lessonId").notNull().unique(),
  storageKey: varchar("storageKey", { length: 512 }),
  contentType: varchar("contentType", { length: 120 }).default("video/webm").notNull(),
  status: mysqlEnum("status", ["recording", "processing", "ready", "failed"])
    .default("recording")
    .notNull(),
  durationSec: int("durationSec").default(0).notNull(),
  sizeBytes: int("sizeBytes").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  readyAt: timestamp("readyAt"),
});

export type Recording = typeof recordings.$inferSelect;

/** الواجبات التي ينشئها المعلم */
export const assignments = mysqlTable("assignments", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  teacherId: int("teacherId").notNull(),
  schoolId: int("schoolId").notNull(),
  lessonId: int("lessonId"),
  dueAt: timestamp("dueAt").notNull(),
  maxGrade: int("maxGrade").default(100).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Assignment = typeof assignments.$inferSelect;

/** تسليمات الطلاب */
export const submissions = mysqlTable(
  "submissions",
  {
    id: int("id").autoincrement().primaryKey(),
    assignmentId: int("assignmentId").notNull(),
    studentId: int("studentId").notNull(),
    content: text("content"),
    fileKey: varchar("fileKey", { length: 512 }),
    fileName: varchar("fileName", { length: 255 }),
    grade: int("grade"),
    feedback: text("feedback"),
    submittedAt: timestamp("submittedAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    gradedAt: timestamp("gradedAt"),
  },
  table => ({
    assignmentStudentIdx: uniqueIndex("submissions_assignment_student_idx").on(
      table.assignmentId,
      table.studentId
    ),
  })
);

export type Submission = typeof submissions.$inferSelect;
