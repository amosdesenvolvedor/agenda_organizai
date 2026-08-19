import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { open, unlink } from "node:fs/promises";
import path from "node:path";
import multer from "multer";

export type MediaKind = "image" | "video";

const imageMimes = new Set(["image/jpeg", "image/png", "image/webp"]);
const videoMimes = new Set(["video/mp4", "video/webm"]);

export function createMediaUpload(
  folder: string,
  maxBytes: number,
  kind: MediaKind,
  maxFiles = 1,
) {
  const destination = path.join("uploads", folder);
  mkdirSync(destination, { recursive: true });
  return multer({
    storage: multer.diskStorage({
      destination,
      filename: (_req, _file, callback) => callback(null, randomUUID()),
    }),
    limits: { fileSize: maxBytes, files: maxFiles },
    fileFilter: (_req, file, callback) =>
      callback(
        null,
        (kind === "image" ? imageMimes : videoMimes).has(file.mimetype),
      ),
  });
}

function detectedMime(bytes: Buffer): string | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  )
    return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return "image/png";
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString() === "RIFF" &&
    bytes.subarray(8, 12).toString() === "WEBP"
  )
    return "image/webp";
  if (bytes.length >= 12 && bytes.subarray(4, 8).toString() === "ftyp")
    return "video/mp4";
  if (
    bytes.length >= 4 &&
    bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
  )
    return "video/webm";
  return null;
}

export async function detectStoredMediaMime(filePath: string) {
  const handle = await open(filePath, "r");
  try {
    const bytes = Buffer.alloc(32);
    await handle.read(bytes, 0, bytes.length, 0);
    return detectedMime(bytes);
  } finally {
    await handle.close();
  }
}

export async function validateUploadedMedia(
  file: Express.Multer.File,
  kind: MediaKind,
) {
  const handle = await open(file.path, "r");
  const bytes = Buffer.alloc(32);
  await handle.read(bytes, 0, bytes.length, 0);
  await handle.close();
  const actualMime = detectedMime(bytes);
  const allowed = kind === "image" ? imageMimes : videoMimes;
  if (!actualMime || actualMime !== file.mimetype || !allowed.has(actualMime)) {
    await unlink(file.path).catch(() => undefined);
    throw new Error("MEDIA_SIGNATURE_INVALID");
  }
  return actualMime;
}

export async function removeUploadedFiles(files: Express.Multer.File[]) {
  await Promise.all(
    files.map((file) => unlink(file.path).catch(() => undefined)),
  );
}
