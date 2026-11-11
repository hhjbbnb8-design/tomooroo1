import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  deleteRecordingRow,
  getRecordingByLesson,
  markRecordingProcessing,
  markRecordingReady,
} from "./db";
import { storagePutFile } from "./storage";

export const RECORDINGS_TEMP_DIR = path.join(os.tmpdir(), "midad-recordings");

export function recordingTempPath(lessonId: number) {
  return path.join(RECORDINGS_TEMP_DIR, `lesson-${lessonId}.part`);
}

export function ensureTempDir() {
  fs.mkdirSync(RECORDINGS_TEMP_DIR, { recursive: true });
}

export function appendRecordingChunk(lessonId: number, chunk: Buffer) {
  ensureTempDir();
  fs.appendFileSync(recordingTempPath(lessonId), chunk);
  return fs.statSync(recordingTempPath(lessonId)).size;
}

/**
 * يحوّل ملف التسجيل المؤقت إلى أصل دائم في التخزين السحابي ويربطه بالحصة.
 * آمن للتكرار: إن كان التسجيل جاهزاً لا يعيد الرفع.
 */
export async function finalizeRecording(
  lessonId: number,
  options?: { durationSec?: number; mimeType?: string }
) {
  const recording = await getRecordingByLesson(lessonId);
  if (!recording) return null;
  if (recording.status === "ready") return recording;

  const file = recordingTempPath(lessonId);
  if (!fs.existsSync(file) || fs.statSync(file).size < 1000) {
    await deleteRecordingRow(lessonId);
    return null;
  }

  const mimeType =
    options?.mimeType && options.mimeType.startsWith("video/")
      ? options.mimeType.split(";")[0]
      : recording.contentType || "video/webm";
  const extension = mimeType.includes("mp4") ? "mp4" : "webm";
  const sizeBytes = fs.statSync(file).size;
  const key = `recordings/lesson-${lessonId}/${Date.now()}.${extension}`;

  await markRecordingProcessing(recording.id);
  try {
    await storagePutFile(key, file, mimeType);
    await markRecordingReady(recording.id, {
      storageKey: key,
      contentType: mimeType,
      durationSec: Math.max(0, Math.round(options?.durationSec ?? recording.durationSec)),
      sizeBytes,
    });
    fs.rmSync(file, { force: true });
  } catch (error) {
    console.error(`[Recording] Failed to persist lesson ${lessonId}:`, error);
    throw error;
  }
  return getRecordingByLesson(lessonId);
}
