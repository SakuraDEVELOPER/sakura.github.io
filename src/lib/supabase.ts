import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const commentMediaBucket =
  process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET?.trim() || "comment-media";

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase env is missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export const supabaseCommentMediaBucket = commentMediaBucket;
