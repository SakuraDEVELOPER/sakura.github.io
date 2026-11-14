import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const commentMediaBucket =
  process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET?.trim() || "comment-media";
const normalizedSupabaseUrl = supabaseUrl?.trim().replace(/\/+$/, "") || "";
const encodedSupabaseBucket = encodeURIComponent(commentMediaBucket);
const supabasePublicObjectBaseUrl = normalizedSupabaseUrl
  ? `${normalizedSupabaseUrl}/storage/v1/object/public/${encodedSupabaseBucket}`
  : "";
const supabaseRenderedImageBaseUrl = normalizedSupabaseUrl
  ? `${normalizedSupabaseUrl}/storage/v1/render/image/public/${encodedSupabaseBucket}`
  : "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const supabaseCommentMediaBucket = commentMediaBucket;

export const supabase =
  isSupabaseConfigured && supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

const normalizeStorageObjectPath = (objectPath: string | null | undefined) =>
  typeof objectPath === "string" ? objectPath.trim().replace(/^\/+/, "") : "";
const encodeStorageObjectPath = (normalizedPath: string) =>
  normalizedPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

export function getSupabasePublicObjectUrl(objectPath: string | null | undefined) {
  const normalizedPath = normalizeStorageObjectPath(objectPath);

  if (!normalizedPath) {
    return null;
  }

  const encodedPath = encodeStorageObjectPath(normalizedPath);

  if (supabasePublicObjectBaseUrl) {
    return `${supabasePublicObjectBaseUrl}/${encodedPath}`;
  }

  if (!supabase) {
    return null;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(supabaseCommentMediaBucket).getPublicUrl(normalizedPath);

  return publicUrl || null;
}

export function getSupabaseRenderedImageUrl(
  objectPath: string | null | undefined,
  _options?: {
    width?: number;
    height?: number;
    quality?: number;
    resize?: "contain" | "cover" | "fill";
  }
) {
  // Supabase Image Transformation (/storage/v1/render/image/...) requires a paid Pro plan
  // and returns 403 (FeatureNotEnabled) on projects without it.
  // Fall back to the public object URL to ensure all images load properly.
  return getSupabasePublicObjectUrl(objectPath);
}
