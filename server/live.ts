import express, { Router, type Request, type Response } from "express";
import { getUserFromRequest } from "./auth";
import {
  createRecording,
  getLessonById,
  getRecordingByLesson,
  updateLesson,
} from "./db";
import { appendRecordingChunk, finalizeRecording } from "./recordings";
import type { User } from "../drizzle/schema";

type Participant = {
  userId: number;
  name: string;
  role: "teacher" | "student";
  joinedAt: number;
  lastSeen: number;
  handRaised: boolean;
};

type SignalMessage = {
  seq: number;
  from: number;
  to: number | "*";
  data: unknown;
};

type Room = {
  lessonId: number;
  participants: Map<number, Participant>;
  messages: SignalMessage[];
  seq: number;
  ended: boolean;
  endedAt?: number;
};

const rooms = new Map<number, Room>();

function ensureRoom(lessonId: number): Room {
  let room = rooms.get(lessonId);
  if (!room) {
    room = { lessonId, participants: new Map(), messages: [], seq: 0, ended: false };
    rooms.set(lessonId, room);
  }
  return room;
}

function pushMessage(room: Room, from: number | 0, to: number | "*", data: unknown) {
  room.seq += 1;
  room.messages.push({ seq: room.seq, from: from as number, to, data });
  if (room.messages.length > 400) {
    room.messages.splice(0, room.messages.length - 400);
  }
  return room.seq;
}

function publicParticipants(room: Room) {
  return [...room.participants.values()]
    .sort((a, b) => (a.role === b.role ? a.joinedAt - b.joinedAt : a.role === "teacher" ? -1 : 1))
    .map(p => ({
      userId: p.userId,
      name: p.name,
      role: p.role,
      handRaised: p.handRaised,
    }));
}

async function requireUser(req: Request, res: Response): Promise<User | null> {
  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "يجب تسجيل الدخول أولاً" });
    return null;
  }
  return user;
}

function canAccessLesson(user: User, lesson: { schoolId: number; teacherId: number }) {
  if (user.role === "teacher") return lesson.teacherId === user.id;
  if (user.role === "student") return user.schoolId === lesson.schoolId;
  return false;
}

export async function startLiveLesson(lessonId: number, teacherId: number) {
  const lesson = await getLessonById(lessonId);
  if (!lesson) throw new Error("الحصة غير موجودة");
  if (lesson.teacherId !== teacherId) throw new Error("ليست حصتك");
  if (lesson.status === "ended") throw new Error("انتهت هذه الحصة بالفعل");
  if (lesson.status !== "live") {
    await updateLesson(lessonId, { status: "live", startedAt: lesson.startedAt ?? new Date() });
  }
  const recording = await createRecording(lessonId);
  ensureRoom(lessonId);
  return { lesson: await getLessonById(lessonId), recording };
}

export async function endLiveLesson(lessonId: number) {
  const lesson = await getLessonById(lessonId);
  if (!lesson) return null;
  if (lesson.status !== "ended") {
    await updateLesson(lessonId, { status: "ended", endedAt: new Date() });
  }
  const room = rooms.get(lessonId);
  if (room && !room.ended) {
    room.ended = true;
    room.endedAt = Date.now();
    pushMessage(room, 0, "*", { type: "ended" });
  }
  try {
    await finalizeRecording(lessonId);
  } catch (error) {
    console.error(`[Live] Failed to finalize recording for lesson ${lessonId}:`, error);
  }
  return getLessonById(lessonId);
}

export function registerLiveRoutes(app: express.Express) {
  const router = Router();

  // استقبال دفعات التسجيل كبايتات خام
  router.post(
    "/recording/chunk",
    express.raw({ type: "application/octet-stream", limit: "64mb" }),
    async (req, res) => {
      const user = await requireUser(req, res);
      if (!user) return;
      const lessonId = Number(req.get("x-lesson-id"));
      if (!Number.isInteger(lessonId)) {
        res.status(400).json({ error: "معرّف الحصة غير صالح" });
        return;
      }
      const lesson = await getLessonById(lessonId);
      if (!lesson || lesson.teacherId !== user.id) {
        res.status(403).json({ error: "غير مصرح" });
        return;
      }
      const recording = await getRecordingByLesson(lessonId);
      if (!recording || recording.status !== "recording") {
        res.status(409).json({ error: "لا يوجد تسجيل جارٍ لهذه الحصة" });
        return;
      }
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        res.status(400).json({ error: "دفعة فارغة" });
        return;
      }
      try {
        const total = appendRecordingChunk(lessonId, req.body);
        res.json({ ok: true, bytes: total });
      } catch (error) {
        console.error("[Live] Failed to append recording chunk:", error);
        res.status(500).json({ error: "تعذر حفظ دفعة التسجيل" });
      }
    }
  );

  router.post("/recording/finalize", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    const lessonId = Number(req.body?.lessonId);
    if (!Number.isInteger(lessonId)) {
      res.status(400).json({ error: "معرّف الحصة غير صالح" });
      return;
    }
    const lesson = await getLessonById(lessonId);
    if (!lesson || lesson.teacherId !== user.id) {
      res.status(403).json({ error: "غير مصرح" });
      return;
    }
    try {
      const recording = await finalizeRecording(lessonId, {
        durationSec: Number(req.body?.durationSec) || 0,
        mimeType: typeof req.body?.mimeType === "string" ? req.body.mimeType : undefined,
      });
      res.json({ ok: true, recording });
    } catch (error) {
      console.error("[Live] Finalize failed:", error);
      res.status(500).json({ error: "تعذر حفظ التسجيل" });
    }
  });

  router.get("/recording/status", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    const lessonId = Number(req.query.lessonId);
    const lesson = Number.isInteger(lessonId) ? await getLessonById(lessonId) : undefined;
    if (!lesson || !canAccessLesson(user, lesson)) {
      res.status(403).json({ error: "غير مصرح" });
      return;
    }
    const recording = await getRecordingByLesson(lessonId);
    res.json({ recording: recording ?? null });
  });

  router.post("/join", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    const lessonId = Number(req.body?.lessonId);
    const lesson = Number.isInteger(lessonId) ? await getLessonById(lessonId) : undefined;
    if (!lesson) {
      res.status(404).json({ error: "الحصة غير موجودة" });
      return;
    }
    if (!canAccessLesson(user, lesson)) {
      res.status(403).json({ error: "هذه الحصة ليست ضمن مدرستك" });
      return;
    }
    if (lesson.status !== "live") {
      res.status(409).json({
        error:
          lesson.status === "scheduled"
            ? "لم تبدأ الحصة بعد"
            : "انتهت هذه الحصة، يمكنك مشاهدة تسجيلها",
      });
      return;
    }
    const room = ensureRoom(lessonId);
    if (room.ended) {
      res.status(410).json({ error: "انتهت هذه الحصة" });
      return;
    }
    const existing = room.participants.get(user.id);
    const participant: Participant = existing
      ? { ...existing, lastSeen: Date.now() }
      : {
          userId: user.id,
          name: user.name,
          role: user.role === "teacher" ? "teacher" : "student",
          joinedAt: Date.now(),
          lastSeen: Date.now(),
          handRaised: false,
        };
    room.participants.set(user.id, participant);
    const recording = await getRecordingByLesson(lessonId);
    res.json({
      participant: { userId: user.id, name: user.name, role: participant.role },
      participants: publicParticipants(room),
      seq: room.seq,
      lesson: {
        id: lesson.id,
        title: lesson.title,
        status: lesson.status,
        startedAt: lesson.startedAt,
        teacherId: lesson.teacherId,
      },
      recording: recording ?? null,
    });
  });

  router.get("/state", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    const lessonId = Number(req.query.lessonId);
    const since = Number(req.query.since) || 0;
    const lesson = Number.isInteger(lessonId) ? await getLessonById(lessonId) : undefined;
    if (!lesson || !canAccessLesson(user, lesson)) {
      res.status(403).json({ error: "غير مصرح" });
      return;
    }
    const room = rooms.get(lessonId);
    if (!room) {
      res.json({
        participants: [],
        messages: [],
        seq: since,
        status: lesson.status,
        ended: lesson.status === "ended",
      });
      return;
    }
    const me = room.participants.get(user.id);
    if (me) me.lastSeen = Date.now();
    const messages = room.messages.filter(
      m => m.seq > since && (m.to === "*" || m.to === user.id)
    );
    res.json({
      participants: publicParticipants(room),
      messages,
      seq: room.seq,
      status: room.ended ? "ended" : lesson.status,
      ended: room.ended || lesson.status === "ended",
      startedAt: lesson.startedAt,
      recording: undefined,
    });
  });

  router.post("/signal", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    const lessonId = Number(req.body?.lessonId);
    const to = req.body?.to === "*" ? "*" : Number(req.body?.to);
    const data = req.body?.data;
    if (!Number.isInteger(lessonId) || (to !== "*" && !Number.isInteger(to))) {
      res.status(400).json({ error: "طلب غير صالح" });
      return;
    }
    if (!data || typeof data !== "object" || JSON.stringify(data).length > 200_000) {
      res.status(400).json({ error: "بيانات غير صالحة" });
      return;
    }
    const room = rooms.get(lessonId);
    if (!room || room.ended) {
      res.status(409).json({ error: "الحصة غير متاحة" });
      return;
    }
    const me = room.participants.get(user.id);
    if (!me) {
      res.status(409).json({ error: "أنت غير منضم للحصة" });
      return;
    }
    me.lastSeen = Date.now();
    if (to !== "*" && !room.participants.has(to)) {
      res.json({ ok: true, skipped: true });
      return;
    }
    const payload = data as { type?: string; raised?: boolean };
    if (payload.type === "hand" && me.role === "student") {
      me.handRaised = Boolean(payload.raised);
    }
    pushMessage(room, user.id, to, data);
    res.json({ ok: true });
  });

  router.post("/leave", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    const lessonId = Number(req.body?.lessonId);
    const room = Number.isInteger(lessonId) ? rooms.get(lessonId) : undefined;
    if (room) {
      room.participants.delete(user.id);
      pushMessage(room, 0, "*", { type: "peer-left", userId: user.id });
    }
    res.json({ ok: true });
  });

  router.post("/control", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    if (user.role !== "teacher") {
      res.status(403).json({ error: "المعلم فقط يمكنه إدارة البث" });
      return;
    }
    const lessonId = Number(req.body?.lessonId);
    const action = req.body?.action;
    const lesson = Number.isInteger(lessonId) ? await getLessonById(lessonId) : undefined;
    if (!lesson || lesson.teacherId !== user.id) {
      res.status(403).json({ error: "غير مصرح" });
      return;
    }
    try {
      if (action === "start") {
        const result = await startLiveLesson(lessonId, user.id);
        res.json({ ok: true, lesson: result.lesson, recording: result.recording });
      } else if (action === "end") {
        const updated = await endLiveLesson(lessonId);
        res.json({ ok: true, lesson: updated });
      } else {
        res.status(400).json({ error: "إجراء غير معروف" });
      }
    } catch (error) {
      res.status(409).json({ error: error instanceof Error ? error.message : "تعذر تنفيذ الإجراء" });
    }
  });

  app.use("/api/live", router);

  // إنهاء تلقائي للحصص التي انقطع فيها المعلم حتى لا تبقى معلّقة
  const janitor = setInterval(async () => {
    const now = Date.now();
    for (const room of rooms.values()) {
      try {
        if (room.ended) {
          if (now - (room.endedAt ?? now) > 10 * 60 * 1000) rooms.delete(room.lessonId);
          continue;
        }
        const lesson = await getLessonById(room.lessonId);
        if (!lesson || lesson.status !== "live") continue;
        const teacher = [...room.participants.values()].find(p => p.role === "teacher");
        const students = [...room.participants.values()].filter(p => p.role === "student");
        if (students.length === 0) continue;
        if (!teacher || now - teacher.lastSeen > 3 * 60 * 1000) {
          console.log(`[Live] Auto-ending lesson ${room.lessonId} (teacher inactive)`);
          await endLiveLesson(room.lessonId);
        }
      } catch (error) {
        console.error("[Live] Janitor error:", error);
      }
    }
  }, 30_000);
  janitor.unref();
}
