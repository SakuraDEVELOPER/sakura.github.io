import { isSupabaseConfigured, supabase, supabaseCommentMediaBucket } from "./supabase";

const MAX_COMMENT_MEDIA_BYTES = 50 * 1024 * 1024;
const ALLOWED_COMMENT_MEDIA_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
]);
const ALLOWED_AVATAR_MEDIA_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
]);
const ALLOWED_PROFILE_THEME_AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/aac",
  "audio/flac",
  "audio/mp4",
  "audio/x-m4a",
  "audio/webm",
]);
const MAX_AVATAR_UPLOAD_BYTES = 50 * 1024 * 1024;
const MAX_PROFILE_THEME_AUDIO_UPLOAD_BYTES = 50 * 1024 * 1024;
const PROFILE_THEME_AUDIO_CONTENT_TYPE_FALLBACKS = new Map<string, string[]>([
  ["audio/mpeg", ["audio/mp3"]],
  ["audio/mp3", ["audio/mpeg"]],
  ["audio/wav", ["audio/x-wav"]],
  ["audio/x-wav", ["audio/wav"]],
  ["audio/mp4", ["audio/x-m4a"]],
  ["audio/x-m4a", ["audio/mp4"]],
]);

export type SupabaseCommentMediaUploadResult = {
  bucket: string;
  path: string;
  publicUrl: string;
  contentType: string;
  size: number;
  reused: boolean;
};

function sanitizeFileName(fileName: string) {
  const trimmed = fileName.trim().replace(/\s+/g, "-");
  const cleaned = trimmed.replace(/[^A-Za-z0-9._-]/g, "");

  return cleaned || "upload";
}

function inferFileExtension(file: File) {
  switch (file.type) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "video/mp4":
      return "mp4";
    case "video/webm":
      return "webm";
    case "audio/mpeg":
    case "audio/mp3":
      return "mp3";
    case "audio/wav":
    case "audio/x-wav":
      return "wav";
    case "audio/ogg":
      return "ogg";
    case "audio/aac":
      return "aac";
    case "audio/flac":
      return "flac";
    case "audio/mp4":
    case "audio/x-m4a":
      return "m4a";
    case "audio/webm":
      return "webm";
    default: {
      const nameParts = file.name.split(".");
      return nameParts.length > 1 ? sanitizeFileName(nameParts.pop() ?? "") || "bin" : "bin";
    }
  }
}

async function buildObjectPath(file: File, folder: string, userId = "guest") {
  const safeUserId = sanitizeFileName(userId);
  const safeBaseName = sanitizeFileName(file.name.replace(/\.[^.]+$/, "")) || "upload";
  const extension = inferFileExtension(file);
  const uniqueSuffix =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return `${folder}/${safeUserId}/${safeBaseName}-${uniqueSuffix}.${extension}`;
}

export function validateSupabaseCommentMediaFile(file: File) {
  if (!ALLOWED_COMMENT_MEDIA_TYPES.has(file.type)) {
    throw new Error("Only PNG, JPG, WEBP, GIF, MP4, and WEBM files are supported.");
  }

  if (file.size <= 0 || file.size > MAX_COMMENT_MEDIA_BYTES) {
    throw new Error("The selected file exceeds the 50 MB limit.");
  }
}

export function validateSupabaseAvatarFile(file: File) {
  if (!ALLOWED_AVATAR_MEDIA_TYPES.has(file.type)) {
    throw new Error("Avatar must be PNG, JPG, WEBP, GIF, MP4, or WEBM.");
  }

  if (file.size <= 0 || file.size > MAX_AVATAR_UPLOAD_BYTES) {
    throw new Error("The selected avatar exceeds the 50 MB limit.");
  }
}

export function validateSupabaseProfileThemeAudioFile(file: File) {
  if (!ALLOWED_PROFILE_THEME_AUDIO_TYPES.has(file.type)) {
    throw new Error("Profile music must be MP3, WAV, OGG, AAC, FLAC, M4A, or WEBM audio.");
  }

  if (file.size <= 0 || file.size > MAX_PROFILE_THEME_AUDIO_UPLOAD_BYTES) {
    throw new Error("The selected track exceeds the 50 MB limit.");
  }
}

const resolveProfileThemeAudioContentTypes = (file: File) => {
  const normalizedType = file.type.trim().toLowerCase();
  const fallbacks = PROFILE_THEME_AUDIO_CONTENT_TYPE_FALLBACKS.get(normalizedType) ?? [];
  const contentTypes = [normalizedType, ...fallbacks]
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return Array.from(new Set(contentTypes));
};

const isUnsupportedStorageMimeTypeError = (error: unknown) => {
  const message =
    typeof error === "object" && error && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : error instanceof Error
        ? error.message
        : "";
  return /mime type/i.test(message) && /not supported/i.test(message);
};

async function uploadStorageObject(
  file: File,
  objectPath: string,
  contentType = file.type
): Promise<SupabaseCommentMediaUploadResult> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured for this build.");
  }
  const { error } = await supabase.storage
    .from(supabaseCommentMediaBucket)
    .upload(objectPath, file, {
      cacheControl: "3600",
      contentType,
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
    contentType,
    size: file.size,
    reused: false,
  };
}

export async function uploadSupabaseCommentMedia(
  file: File,
  userId: string
): Promise<SupabaseCommentMediaUploadResult> {
  validateSupabaseCommentMediaFile(file);
  return uploadStorageObject(file, await buildObjectPath(file, "comments", userId));
}

export async function uploadSupabaseAvatarMedia(
  file: File,
  userId: string
): Promise<SupabaseCommentMediaUploadResult> {
  validateSupabaseAvatarFile(file);
  return uploadStorageObject(file, await buildObjectPath(file, "avatars", userId));
}

export async function uploadSupabaseProfileThemeAudio(
  file: File,
  userId: string
): Promise<SupabaseCommentMediaUploadResult> {
  validateSupabaseProfileThemeAudioFile(file);
  const objectPath = await buildObjectPath(file, "profile-music", userId);
  const contentTypes = resolveProfileThemeAudioContentTypes(file);
  let lastError: unknown = null;

  for (let index = 0; index < contentTypes.length; index += 1) {
    const contentType = contentTypes[index];

    try {
      return await uploadStorageObject(file, objectPath, contentType);
    } catch (error) {
      lastError = error;
      const hasNextAttempt = index < contentTypes.length - 1;

      if (!hasNextAttempt || !isUnsupportedStorageMimeTypeError(error)) {
        throw error;
      }
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error("Could not upload profile music.");
}

export async function uploadSupabaseCommentMediaTest(file: File) {
  validateSupabaseCommentMediaFile(file);
  return uploadStorageObject(file, await buildObjectPath(file, "tests"));
}

export async function deleteSupabaseStorageObject(objectPath: string) {
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

export async function deleteSupabaseCommentMedia(objectPath: string) {
  return deleteSupabaseStorageObject(objectPath);
}