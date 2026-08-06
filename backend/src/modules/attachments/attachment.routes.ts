import { randomUUID } from "node:crypto";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/async-handler.js";

const allowedMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4"
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: "uploads",
    filename: (_req, file, cb) => {
      cb(null, `${randomUUID()}${path.extname(file.originalname)}`);
    }
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, allowedMimeTypes.has(file.mimetype));
  }
});

export const attachmentRouter = Router();
attachmentRouter.use(requireAuth);

attachmentRouter.post(
  "/events/:eventId",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(422).json({ message: "Arquivo invalido ou ausente." });

    const event = await prisma.event.findFirst({
      where: { id: req.params.eventId, calendar: { ownerId: req.user!.sub } }
    });
    if (!event) return res.status(404).json({ message: "Evento nao encontrado." });

    const attachment = await prisma.attachment.create({
      data: {
        eventId: event.id,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        path: req.file.path
      }
    });

    res.status(201).json({ attachment });
  })
);
