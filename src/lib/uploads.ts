import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { dataDir } from "../db";

const uploadsDir = path.join(dataDir, "uploads");

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

/** Saves an uploaded photo to DATA_DIR/uploads and returns its relative path
 *  (served later via /uploads/[...path]). Rejects anything that isn't a
 *  recognized image type. */
export async function saveUploadedPhoto(file: File): Promise<string> {
  const ext = EXT_BY_MIME[file.type];
  if (!ext) throw new Error(`Unsupported image type: ${file.type || "unknown"}`);

  await fs.mkdir(uploadsDir, { recursive: true });

  const filename = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(uploadsDir, filename), bytes);

  return filename;
}

export async function deleteUploadedPhoto(relativePath: string): Promise<void> {
  const resolved = path.join(uploadsDir, relativePath);
  if (!resolved.startsWith(uploadsDir)) return; // guard against path traversal
  await fs.rm(resolved, { force: true });
}

export { uploadsDir };
