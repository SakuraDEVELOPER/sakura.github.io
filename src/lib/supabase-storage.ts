import { supabase, supabaseCommentMediaBucket } from "./supabase";

const MAX_TEST_UPLOAD_BYTES = 50 * 1024 * 1024;
const ALLOWED_COMMENT_MEDIA_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function sanitizeFileName(fileName: string) {
  const trimmed = fileName.trim().replace(/\s+/g, "-");
  const cleaned = trimmed.replace(/[^A-Za-z0-9._-]/g, "");

  return cleaned || "upload";
}

function buildTestObjectPath(file: File) {
  const date = new Date();
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const objectId = crypto.randomUUID();

  return `tests/${year}/${month}/${objectId}-${sanitizeFileName(file.name)}`;
}

export function validateSupabaseCommentMediaFile(file: File) {
  if (!ALLOWED_COMMENT_MEDIA_TYPES.has(file.type)) {
    throw new Error("Only PNG, JPG, WEBP, and GIF files are supported.");
  }

  if (file.size <= 0 || file.size > MAX_TEST_UPLOAD_BYTES) {
    throw new Error("The selected file exceeds the 50 MB limit.");
  }
}

export async function uploadSupabaseCommentMediaTest(file: File) {
  validateSupabaseCommentMediaFile(file);

  const objectPath = buildTestObjectPath(file);
  const { error } = await supabase.storage
    .from(supabaseCommentMediaBucket)
    .upload(objectPath, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    throw error;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(supabaseCommentMediaBucket).getPublicUrl(objectPath);

  return {
    bucket: supabaseCommentMediaBucket,
    path: objectPath,
    publicUrl,
    contentType: file.type,
    size: file.size,
  };
}
