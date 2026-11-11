export const AUTH_SNAPSHOT_CACHE_STORAGE_KEY = "sakura-auth-snapshot-v1";

type CachedAuthSnapshotShape = {
  uid: string;
  isAnonymous?: boolean;
};

const isCachedAuthSnapshotShape = (value: unknown): value is CachedAuthSnapshotShape =>
  typeof value === "object" &&
  value !== null &&
  "uid" in value &&
  typeof (value as { uid?: unknown }).uid === "string";

export function readCachedAuthSnapshot<T extends CachedAuthSnapshotShape>(): T | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    // Only return cached auth snapshot if there is an active Supabase session in localStorage
    const hasSupabaseSession = Object.keys(window.localStorage).some(
      (k) => k.startsWith("sb-") && k.endsWith("-auth-token")
    );
    if (!hasSupabaseSession) {
      window.localStorage.removeItem(AUTH_SNAPSHOT_CACHE_STORAGE_KEY);
      return null;
    }

    const rawSnapshot = window.localStorage.getItem(AUTH_SNAPSHOT_CACHE_STORAGE_KEY);

    if (!rawSnapshot) {
      return null;
    }

    const parsedSnapshot = JSON.parse(rawSnapshot);

    if (!isCachedAuthSnapshotShape(parsedSnapshot)) {
      window.localStorage.removeItem(AUTH_SNAPSHOT_CACHE_STORAGE_KEY);
      return null;
    }

    return parsedSnapshot as T;
  } catch {
    return null;
  }
}
