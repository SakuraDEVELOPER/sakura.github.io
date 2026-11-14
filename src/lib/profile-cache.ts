export const PROFILE_CACHE_KEY_PREFIX = "sakura-profile-cache-v2:";

type CachedProfileShape = {
  profileId: number | null;
  uid: string;
};

const isCachedProfileShape = (value: unknown): value is CachedProfileShape =>
  typeof value === "object" &&
  value !== null &&
  "uid" in value &&
  typeof (value as { uid?: unknown }).uid === "string" &&
  "profileId" in value;

const getProfileCacheKey = (profileId: number) => `${PROFILE_CACHE_KEY_PREFIX}${profileId}`;

// Clean up legacy v1 cache entries once per session/load
let legacyCleanupDone = false;
function purgeLegacyCaches() {
  if (legacyCleanupDone || typeof window === "undefined") return;
  legacyCleanupDone = true;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && (key.startsWith("sakura-profile-cache-v1:") || (key.startsWith("sakura-profile-cache-") && !key.startsWith(PROFILE_CACHE_KEY_PREFIX)))) {
        keysToRemove.push(key);
      }
    }
    for (const k of keysToRemove) {
      window.localStorage.removeItem(k);
    }
  } catch {}
}

export function readCachedProfileSnapshot<T extends CachedProfileShape>(
  profileId: number | null | undefined
): T | null {
  if (typeof window === "undefined" || typeof profileId !== "number" || profileId <= 0) {
    return null;
  }

  purgeLegacyCaches();

  try {
    const rawSnapshot = window.localStorage.getItem(getProfileCacheKey(profileId));

    if (!rawSnapshot) {
      return null;
    }

    const parsedSnapshot = JSON.parse(rawSnapshot);

    if (
      !isCachedProfileShape(parsedSnapshot) ||
      parsedSnapshot.profileId !== profileId
    ) {
      window.localStorage.removeItem(getProfileCacheKey(profileId));
      return null;
    }

    return parsedSnapshot as T;
  } catch {
    return null;
  }
}

export function writeCachedProfileSnapshot<T extends CachedProfileShape>(profile: T | null) {
  if (
    typeof window === "undefined" ||
    !profile ||
    typeof profile.profileId !== "number" ||
    profile.profileId <= 0
  ) {
    return;
  }

  try {
    window.localStorage.setItem(getProfileCacheKey(profile.profileId), JSON.stringify(profile));
  } catch {}
}

export function clearCachedProfileSnapshot(profileId: number | null | undefined) {
  if (
    typeof window === "undefined" ||
    typeof profileId !== "number" ||
    profileId <= 0
  ) {
    return;
  }

  try {
    window.localStorage.removeItem(getProfileCacheKey(profileId));
  } catch {}
}

export function clearAllCachedProfileSnapshots() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith("sakura-profile-cache-")) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      window.localStorage.removeItem(key);
    }
  } catch {}
}
