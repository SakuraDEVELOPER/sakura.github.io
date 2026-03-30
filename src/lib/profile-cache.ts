export const PROFILE_CACHE_KEY_PREFIX = "sakura-profile-cache-v1:";

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

export function readCachedProfileSnapshot<T extends CachedProfileShape>(
  profileId: number | null | undefined
): T | null {
  if (typeof window === "undefined" || typeof profileId !== "number" || profileId <= 0) {
    return null;
  }

  try {
    const rawSnapshot = window.localStorage.getItem(getProfileCacheKey(profileId));

    if (!rawSnapshot) {
      return null;
    }

    const parsedSnapshot = JSON.parse(rawSnapshot);

    if (!isCachedProfileShape(parsedSnapshot)) {
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
