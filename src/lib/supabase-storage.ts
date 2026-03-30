import { isSupabaseConfigured, supabase, supabaseCommentMediaBucket } from "./supabase";

const MAX_COMMENT_MEDIA_BYTES = 50 * 1024 * 1024;
const ALLOWED_COMMENT_MEDIA_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export type SupabaseCommentMediaUploadResult = {
  bucket: string;
  path: string;
  publicUrl: string;
  contentType: string;
  size: number;
};

function sanitizeFileName(fileName: string) {
  const trimmed = fileName.trim().replace(/\s+/g, "-");
  const cleaned = trimmed.replace(/[^A-Za-z0-9._-]/g, "");

  return cleaned || "upload";
}

function buildObjectPath(file: File, folder: string, userId = "guest") {
  const date = new Date();
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const objectId = crypto.randomUUID();
  const safeUserId = sanitizeFileName(userId);

  return `${folder}/${safeUserId}/${year}/${month}/${objectId}-${sanitizeFileName(file.name)}`;
}

export function validateSupabaseCommentMediaFile(file: File) {
  if (!ALLOWED_COMMENT_MEDIA_TYPES.has(file.type)) {
    throw new Error("Only PNG, JPG, WEBP, and GIF files are supported.");
  }

  if (file.size <= 0 || file.size > MAX_COMMENT_MEDIA_BYTES) {
    throw new Error("The selected file exceeds the 50 MB limit.");
  }
}

async function uploadCommentMediaObject(file: File, objectPath: string): Promise<SupabaseCommentMediaUploadResult> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured for this build.");
  }

  validateSupabaseCommentMediaFile(file);
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

export async function uploadSupabaseCommentMedia(
  file: File,
  userId: string
): Promise<SupabaseCommentMediaUploadResult> {
  return uploadCommentMediaObject(file, buildObjectPath(file, "comments", userId));
}

export async function uploadSupabaseCommentMediaTest(file: File) {
  return uploadCommentMediaObject(file, buildObjectPath(file, "tests"));
}

export async function deleteSupabaseCommentMedia(objectPath: string) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured for this build.");
  }

  const normalizedObjectPath = objectPath.trim();

  if (!normalizedObjectPath) {
    return;
  }

  const { error } = await supabase.storage
    .from(supabaseCommentMediaBucket)
    .remove([normalizedObjectPath]);

  if (error) {
    throw error;
  }
}
