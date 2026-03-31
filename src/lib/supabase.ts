import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const commentMediaBucket =
  process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET?.trim() || "comment-media";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const supabaseCommentMediaBucket = commentMediaBucket;

export const supabase =
  isSupabaseConfigured && supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export function getSupabasePublicObjectUrl(objectPath: string | null | undefined) {
  const normalizedPath = typeof objectPath === "string" ? objectPath.trim().replace(/^\/+/, "") : "";

  if (!normalizedPath || !supabase) {
    return null;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(supabaseCommentMediaBucket).getPublicUrl(normalizedPath);

  return publicUrl || null;
}
