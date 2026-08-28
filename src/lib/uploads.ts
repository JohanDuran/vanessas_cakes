import crypto from "node:crypto";
import { createSupabaseAdminClient } from "./supabase/admin";

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "photos";

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

/** Uploads a photo to the public Supabase Storage bucket and returns its
 *  full public URL (stored directly in design_photos.path etc. and used
 *  as-is wherever a photo is rendered). Rejects anything that isn't a
 *  recognized image type. */
export async function saveUploadedPhoto(file: File): Promise<string> {
  const ext = EXT_BY_MIME[file.type];
  if (!ext) throw new Error(`Unsupported image type: ${file.type || "unknown"}`);

  const key = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase.storage.from(BUCKET).upload(key, file, {
    contentType: file.type,
    cacheControl: "31536000",
  });
  if (error) throw new Error(`Photo upload failed: ${error.message}`);

  return supabase.storage.from(BUCKET).getPublicUrl(key).data.publicUrl;
}

/** Extracts the storage object key from a public URL previously returned by
 *  saveUploadedPhoto, e.g. ".../storage/v1/object/public/photos/<key>". */
function storageKeyFromPublicUrl(publicUrl: string): string | null {
  const marker = `/object/public/${BUCKET}/`;
  const index = publicUrl.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(publicUrl.slice(index + marker.length));
}

export async function deleteUploadedPhoto(publicUrl: string): Promise<void> {
  const key = storageKeyFromPublicUrl(publicUrl);
  if (!key) return;
  const supabase = createSupabaseAdminClient();
  await supabase.storage.from(BUCKET).remove([key]);
}

export { BUCKET as UPLOADS_BUCKET };
