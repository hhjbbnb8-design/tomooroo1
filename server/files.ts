import { randomUUID } from "node:crypto";
import path from "node:path";
import express, { Router } from "express";
import { getUserFromRequest } from "./auth";
import { presignPut, storagePut } from "./storage";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "doc",
  "docx",
  "ppt",
  "pptx",
  "xls",
  "xlsx",
  "txt",
  "zip",
]);

export function registerFileRoutes(app: import("express").Express) {
  const router = Router();

  router.post("/presign", async (req, res) => {
    const user = await getUserFromRequest(req);
    if (!user) {
      res.status(401).json({ error: "يجب تسجيل الدخول أولاً" });
      return;
    }
    const fileName = typeof req.body?.fileName === "string" ? req.body.fileName : "";
    const size = Number(req.body?.size);
    if (!fileName || fileName.length > 255) {
      res.status(400).json({ error: "اسم الملف غير صالح" });
      return;
    }
    if (!Number.isFinite(size) || size <= 0 || size > MAX_UPLOAD_BYTES) {
      res.status(400).json({ error: "حجم الملف يجب أن يكون أقل من 25 ميجابايت" });
      return;
    }
    const extension = path.extname(fileName).replace(".", "").toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      res.status(400).json({
        error: "نوع الملف غير مدعوم. المسموح: PDF، صور، Word، PowerPoint، Excel، نص، ZIP",
      });
      return;
    }
    try {
      const key = `uploads/${user.id}/${randomUUID()}.${extension}`;
      const uploadUrl = await presignPut(key);
      res.json({ uploadUrl, key, maxBytes: MAX_UPLOAD_BYTES });
    } catch (error) {
      console.error("[Files] Presign failed:", error);
      res.status(500).json({ error: "تعذر تجهيز رفع الملف" });
    }
  });

  // رفع احتياطي عبر الخادم إذا منع المتصفح الرفع المباشر إلى التخزين
  router.post(
    "/upload",
    express.raw({ type: "application/octet-stream", limit: "30mb" }),
    async (req, res) => {
      const user = await getUserFromRequest(req);
      if (!user) {
        res.status(401).json({ error: "يجب تسجيل الدخول أولاً" });
        return;
      }
      const fileName = decodeURIComponent(req.get("x-file-name") ?? "");
      const extension = path.extname(fileName).replace(".", "").toLowerCase();
      if (!fileName || !ALLOWED_EXTENSIONS.has(extension)) {
        res.status(400).json({ error: "نوع الملف غير مدعوم" });
        return;
      }
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        res.status(400).json({ error: "الملف فارغ" });
        return;
      }
      if (req.body.length > MAX_UPLOAD_BYTES) {
        res.status(400).json({ error: "حجم الملف يجب أن يكون أقل من 25 ميجابايت" });
        return;
      }
      try {
        const stored = await storagePut(
          `uploads/${user.id}/${randomUUID()}.${extension}`,
          req.body,
          req.get("content-type") || "application/octet-stream"
        );
        res.json({ key: stored.key, fileName });
      } catch (error) {
        console.error("[Files] Upload failed:", error);
        res.status(500).json({ error: "تعذر رفع الملف" });
      }
    }
  );

  app.use("/api/files", router);
}
