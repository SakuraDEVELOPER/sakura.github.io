"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { AvatarMedia, AVATAR_FILE_ACCEPT } from "../avatar-media";
import { HeaderSocialLinks } from "../header-social-links";
import { SakuraIcon } from "../sakura-icon";
import { TariffsBento } from "../tariffs-bento";
import { SiteOnlineBadge } from "../site-online-badge";
import {
  deleteSupabaseCommentMedia,
  deleteSupabaseStorageObject,
  uploadSupabaseAvatarMedia,
  uploadSupabaseCommentMedia,
  uploadSupabaseProfileThemeAudio,
  type SupabaseCommentMediaUploadResult,
} from "@/lib/supabase-storage";
import {
  getSupabasePublicObjectUrl,
  getSupabaseRenderedImageUrl,
  isSupabaseConfigured,
} from "@/lib/supabase";
import { readCachedAuthSnapshot } from "@/lib/auth-snapshot-cache";
import { readCachedProfileSnapshot, writeCachedProfileSnapshot, clearCachedProfileSnapshot, clearAllCachedProfileSnapshots } from "@/lib/profile-cache";
import { readCachedProfileComments, writeCachedProfileComments } from "@/lib/profile-comments-cache";
import { readCachedSiteOnlineCount, writeCachedSiteOnlineCount } from "@/lib/site-online-cache";
import { type UiLocale, useLocaleText } from "@/lib/ui-locale";

type ActivationRecord = {
  id: string;
  type: "promo" | "admin_grant" | "freeze" | "unfreeze" | "referral_bonus" | "trial";
  code?: string;
  durationDays?: number;
  isLifetime?: boolean;
  activatedAt: string;
  subscriptionUntil?: string | null;
  grantedBy?: string | null;
  note?: string;
  remainingDays?: string | number;
};

type UserProfile = {
  uid: string;
  isAnonymous: boolean;
  email: string | null;
  emailVerified?: boolean;
  verificationRequired?: boolean;
  verificationEmailSent?: boolean;
  login: string | null;
  displayName: string | null;
  profileId: number | null;
  photoURL: string | null;
  avatarPath?: string | null;
  avatarType?: string | null;
  avatarSize?: number | null;
  bannerUrl?: string | null;
  bannerPath?: string | null;
  themeSongKey?: string | null;
  roles: string[];
  isBanned?: boolean;
  bannedAt?: string | null;
  hwid?: string | null;
  subscriptionUntil?: string | null;
  hasClaimedTrial?: boolean;
  trialClaimedAt?: string | null;
  isFrozen?: boolean;
  frozenAt?: string | null;
  lastFrozenAt?: string | null;
  frozenRemainingMs?: number | null;
  activationHistory?: ActivationRecord[];
  referredBy?: string | null;
  referralCount?: number;
  providerIds: string[];
  creationTime: string | null;
  lastSignInTime: string | null;
  displayNameUpdatedAt?: string | null;
  loginUpdatedAt?: string | null;
  presence: { isOnline: boolean; currentPath: string | null; lastSeenAt: string | null } | null;
};

type ProfileComment = {
  id: string;
  profileId: number | null;
  authorUid: string | null;
  authorProfileId: number | null;
  authorName: string;
  authorPhotoURL: string | null;
  authorAccentRole: string | null;
  message: string;
  mediaURL?: string | null;
  mediaType?: string | null;
  mediaPath?: string | null;
  mediaSize?: number | null;
  createdAt: string | null;
  updatedAt?: string | null;
  updatedBy?: "author" | "admin" | null;
  pending?: boolean;
};

type CommentMediaPayload = {
  mediaURL: string;
  mediaType: string;
  mediaPath: string;
  mediaSize: number;
};

type AvatarUploadPayload = {
  photoURL: string;
  avatarType: string;
  avatarPath: string;
  avatarSize: number;
};

type MentionComposerMode = "new" | "edit";

type MentionDraft = {
  start: number;
  end: number;
  query: string;
};

type ProfileThemeSelection = {
  key: string;
  title: string;
  src?: string;
  embedUrl?: string;
  sourceUrl?: string;
  embedHeight?: number;
  embedProvider?: "youtube" | "soundcloud" | "yandex" | "vk";
};

type Bridge = {
  __runtimeVersion?: string;
  getProfileById: (profileId: number) => Promise<UserProfile | null>;
  getProfileByAuthorName: (authorName: string) => Promise<UserProfile | null>;
  getProfilesByLoginPrefix: (loginPrefix: string) => Promise<UserProfile[]>;
  getProfileComments: (profileId: number) => Promise<ProfileComment[]>;
  isCommentMediaPathReferenced: (mediaPath: string) => Promise<boolean>;
  addProfileComment: (
    profileId: number,
    message: string,
    media?: File | CommentMediaPayload | null
  ) => Promise<ProfileComment>;
  updateProfileComment: (
    commentId: string,
    message: string,
    media?: File | CommentMediaPayload | null,
    removeMedia?: boolean
  ) => Promise<ProfileComment | null>;
  deleteProfileComment: (commentId: string) => Promise<string | null>;
  resendVerificationEmail: () => Promise<UserProfile | null>;
  sendPasswordReset: (identifier: string) => Promise<{ email: string }>;
  deleteCurrentAccount: () => Promise<void>;
  refreshVerificationStatus: () => Promise<UserProfile | null>;
  updateDisplayName: (displayName: string) => Promise<UserProfile | null>;
  updateUsername: (username: string, currentPassword?: string) => Promise<UserProfile | null>;
  updatePassword: (currentPassword: string, nextPassword: string) => Promise<UserProfile | null>;
  adminUpdateProfileDisplayName: (profileId: number, displayName: string) => Promise<UserProfile | null>;
  adminUpdateProfileLogin: (profileId: number, login: string) => Promise<UserProfile | null>;
  adminUpdateProfileThemeSong: (profileId: number, themeSongKey: string) => Promise<UserProfile | null>;
  adminDeleteProfile?: (profileId: number) => Promise<boolean>;
  adminUpdateProfileSubscriptionUntil?: (
    profileId: number,
    subscriptionUntil: string | null
  ) => Promise<UserProfile | null>;
  adminResetProfileHwid?: (profileId: number) => Promise<UserProfile | null>;
  adminSetProfileBan: (profileId: number, isBanned: boolean) => Promise<UserProfile | null>;
  adminSetProfileEmailVerification: (profileId: number, isVerified: boolean) => Promise<UserProfile | null>;
  updateProfileRoles: (profileId: number, roles: string[]) => Promise<UserProfile | null>;
  freezeSubscription?: () => Promise<UserProfile | null>;
  unfreezeSubscription?: () => Promise<UserProfile | null>;
  adminToggleUserFreeze?: (profileId: number) => Promise<UserProfile | null>;
  adminCreatePromoCode?: (options: {
    code: string;
    durationDays: number;
    maxUses: number;
    role?: string;
    note?: string;
  }) => Promise<any>;
  adminListPromoCodes?: () => Promise<any[]>;
  adminDeletePromoCode?: (codeId: string) => Promise<boolean>;
  redeemPromoCode?: (code: string) => Promise<{
    success: boolean;
    durationDays: number;
    isLifetime: boolean;
    newUntil: string;
  }>;
  claimFreeTrial?: () => Promise<{
    success: boolean;
    durationDays: number;
    newUntil: string;
  }>;
  updateAvatar: (file: File | AvatarUploadPayload) => Promise<UserProfile | null>;
  deleteAvatar: () => Promise<UserProfile | null>;
  updateBanner?: (payload: any) => Promise<UserProfile | null>;
  deleteBanner?: () => Promise<UserProfile | null>;
  adminUpdateProfileBanner?: (
    profileId: number,
    payload: any
  ) => Promise<UserProfile | null>;
  adminDeleteProfileBanner?: (profileId: number) => Promise<UserProfile | null>;
  adminUpdateProfileAvatar: (
    profileId: number,
    file: File | AvatarUploadPayload
  ) => Promise<UserProfile | null>;
  adminDeleteProfileAvatar: (profileId: number) => Promise<UserProfile | null>;
  syncPresence: (options?: { path?: string; source?: string; forceVisit?: boolean }) => Promise<UserProfile | null>;
  getSiteOnlineCount: () => Promise<number>;
  getSiteOnlineUsers: () => Promise<
    {
      uid: string | null;
      profileId: number | null;
      displayName: string | null;
      login: string | null;
      photoURL: string | null;
      accentRole?: string | null;
      presence?: { lastSeenAt: string | null } | null;
    }[]
  >;
  logout: () => Promise<void>;
  onAuthStateChanged: (callback: (user: UserProfile | null) => void) => () => void;
};

type RuntimeWindow = Window & {
  firebaseConfig?: { projectId?: string };
  sakuraCurrentUserSnapshot?: UserProfile | null;
  sakuraAuthStateSettled?: boolean;
  sakuraBootFirebaseAuth?: () => Promise<unknown> | unknown;
  sakuraStartFirebaseAuth?: () => Promise<unknown> | unknown;
  sakuraFirebaseAuth?: Bridge;
  sakuraFirebaseAuthError?: string;
  sakuraFirebaseRuntimeVersion?: string;
};

const FIREBASE_AUTH_RUNTIME_VERSION = "2026-04-05-runtime-v3";
const AUTH_READY_EVENT = "sakura-auth-ready";
const AUTH_ERROR_EVENT = "sakura-auth-error";
const AUTH_STATE_SETTLED_EVENT = "sakura-auth-state-settled";
const USER_UPDATE_EVENT = "sakura-user-update";
const PRESENCE_DIRTY_EVENT = "sakura-presence-dirty";
const FLOATING_UI_VISIBILITY_EVENT = "sakura-floating-ui-visibility";
const PROFILE_PATH_STORAGE_KEY = "sakura-profile-path";
const CURRENT_PROFILE_ID_STORAGE_KEY = "sakura-current-profile-id";
const PROFILE_BUILD_MARKER = "role-colors-v61";
const repoBasePath = "/sakura.github.io";
const PROFILE_THEME_OPTIONS = [
  {
    key: "where-is-my-mind",
    title: "Pixies - Where Is My Mind",
    src: `${repoBasePath}/music/where-is-my-mind.mp3`,
  },
  {
    key: "forever-young",
    title: "Face - Forever Young",
    src: `${repoBasePath}/music/Face-forever-young.mp3`,
  },
  {
    key: "cyberpunk",
    title: "Cyberpunk",
    src: `${repoBasePath}/music/cyberpunk.mp3`,
  },
] as const;
const PROFILE_THEME_BY_KEY = new Map<string, (typeof PROFILE_THEME_OPTIONS)[number]>(
  PROFILE_THEME_OPTIONS.map((track) => [track.key, track])
);
const PROFILE_THEME_DEFAULT_KEY_BY_PROFILE_ID = new Map<number, string>([
  [2, "forever-young"],
  [3, "cyberpunk"],
]);
const COMMENT_MENTION_PATTERN = /@([A-Za-z\u0400-\u04FF0-9._-]{3,24})/g;
const COMMENT_MENTION_DRAFT_PATTERN = /(^|[\s([{"'`])@([A-Za-z\u0400-\u04FF0-9._-]{2,24})$/;
const COMMENT_MENTION_TOKEN_CHARACTER_PATTERN = /[A-Za-z\u0400-\u04FF0-9._-]/;
const COMMENT_MEDIA_FILE_ACCEPT = ".png,.jpg,.jpeg,.webp,.gif,.mp4,.webm";
const PROFILE_THEME_AUDIO_FILE_ACCEPT = ".mp3,.wav,.ogg,.aac,.flac,.m4a,.webm,audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/ogg,audio/aac,audio/flac,audio/mp4,audio/x-m4a,audio/webm";
const PRESENCE_ACTIVE_WINDOW_MS = 90 * 1000;
const SITE_ONLINE_COUNT_REFRESH_INTERVAL_MS = 20 * 1000;
const SITE_ONLINE_COUNT_REFRESH_DEBOUNCE_MS = 280;
const PROFILE_NAV_SCAN_LIMIT = 3;
const PROFILE_NAV_PREFETCH_PER_SIDE = 2;
const PROFILE_THEME_TIMELINE_UPDATE_STEP_SECONDS = 0.24;
const PROFILE_THEME_EMBED_FALLBACK_DURATION_SECONDS = 5 * 60;
const FUNPAY_SUBSCRIPTION_URL = "https://funpay.com/lots/offer?id=67099133";
const FUNPAY_ICON_URL = "https://funpay.com/favicon.ico";
const FUNPAY_DONATION_TRACK_SRC = `${repoBasePath}/music/kto-to-mne-zadonatil.mp3`;
const STALE_RUNTIME_RECOVERY_STORAGE_KEY = "sakura-stale-runtime-recovery-at";
const STALE_RUNTIME_RECOVERY_COUNT_STORAGE_KEY = "sakura-stale-runtime-recovery-count";
const STALE_RUNTIME_RECOVERY_COOLDOWN_MS = 5 * 60 * 1000;
const STALE_RUNTIME_RECOVERY_MAX_PER_SESSION = 1;
const STALE_RUNTIME_ERROR_PATTERNS = [
  /cacheResolvedProfileSnapshot is not defined/i,
  /AUTH_RUNTIME_INSTALLED_EVENT is not defined/i,
  /writeRuntimeCacheEntry is not defined/i,
];
const restoreProfilePathScript = `
  (function () {
    try {
      var fallbackPath = window.sessionStorage.getItem(${JSON.stringify(PROFILE_PATH_STORAGE_KEY)});
      var currentProfileId = window.sessionStorage.getItem(${JSON.stringify(CURRENT_PROFILE_ID_STORAGE_KEY)});
      var currentPath = window.location.pathname;
      var profilePath = ${JSON.stringify(repoBasePath + "/profile")};
      var profilePattern = new RegExp("^" + ${JSON.stringify(repoBasePath)} + "/profile/\\\\d+$");

      if (currentPath === profilePath) {
        if (fallbackPath && profilePattern.test(fallbackPath)) {
          window.history.replaceState(null, "", fallbackPath);
          return;
        }

        if (currentProfileId && /^\\d+$/.test(currentProfileId)) {
          window.history.replaceState(null, "", profilePath + "/" + currentProfileId);
        }
      }
    } catch (error) {}
  })();
`;

const getWindowState = () => window as RuntimeWindow;
const PROFILE_THEME_EXTERNAL_URL_PREFIX = "url:";
const PROFILE_THEME_EXTERNAL_URL_MAX_LENGTH = 1024;
const PROFILE_THEME_AUDIO_URL_PATH_PATTERN = /\.(?:mp3|wav|ogg|aac|flac|m4a|webm)(?:$|[?#])/i;
const normalizeProfileThemePresetKey = (value: unknown): string | null => {
  const normalizedKey =
    typeof value === "string"
      ? value
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9-]+/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-+|-+$/g, "")
      : "";

  if (!normalizedKey) {
    return null;
  }

  return PROFILE_THEME_BY_KEY.has(normalizedKey) ? normalizedKey : null;
};
const parseProfileThemeExternalUrl = (value: string): URL | null => {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const candidateValue =
    /^https?:\/\//i.test(trimmedValue)
      ? trimmedValue
      : /^[A-Za-z0-9.-]+\.[A-Za-z]{2,}(?:[/:?#]|$)/.test(trimmedValue)
        ? `https://${trimmedValue}`
        : trimmedValue;

  try {
    return new URL(candidateValue);
  } catch {
    return null;
  }
};
const resolveNormalizedProfileThemeExternalSourceUrl = (parsedUrl: URL) =>
  `${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname}${parsedUrl.search}`;
const isProfileThemeAudioFileUrl = (parsedUrl: URL) =>
  PROFILE_THEME_AUDIO_URL_PATH_PATTERN.test(`${parsedUrl.pathname}${parsedUrl.search}`);
const resolveExternalProfileThemeSongSelection = (
  value: string
): ProfileThemeSelection | null => {
  const rawValue = value.trim();
  const externalCandidate = rawValue.toLowerCase().startsWith(PROFILE_THEME_EXTERNAL_URL_PREFIX)
    ? rawValue.slice(PROFILE_THEME_EXTERNAL_URL_PREFIX.length).trim()
    : rawValue;
  const parsedUrl = parseProfileThemeExternalUrl(externalCandidate);

  if (!parsedUrl) {
    return null;
  }

  const host = parsedUrl.hostname.toLowerCase().replace(/^www\./, "");
  const buildSelection = (
    title: string,
    sourceUrl: string,
    options: {
      src?: string;
      embedUrl?: string;
      embedHeight?: number;
      embedProvider?: "soundcloud";
    } = {}
  ): ProfileThemeSelection | null => {
    const normalizedSourceUrl = sourceUrl.trim();

    if (!normalizedSourceUrl || normalizedSourceUrl.length > PROFILE_THEME_EXTERNAL_URL_MAX_LENGTH) {
      return null;
    }

    return {
      key: `${PROFILE_THEME_EXTERNAL_URL_PREFIX}${normalizedSourceUrl}`,
      title,
      sourceUrl: normalizedSourceUrl,
      src: options.src,
      embedUrl: options.embedUrl,
      embedHeight: options.embedHeight,
      embedProvider: options.embedProvider,
    };
  };

  if (host === "soundcloud.com" || host === "m.soundcloud.com" || host === "on.soundcloud.com") {
    const sourceUrl = `https://${host}${parsedUrl.pathname}${parsedUrl.search}`;
    const embedUrl = `https://w.soundcloud.com/player/?url=${encodeURIComponent(sourceUrl)}&auto_play=true&enable_api=true&hide_related=true&show_teaser=false&show_comments=false&show_user=true&show_reposts=false&visual=false`;
    return buildSelection("SoundCloud", sourceUrl, {
      embedUrl,
      embedHeight: 166,
      embedProvider: "soundcloud",
    });
  }

  const sourceUrl = resolveNormalizedProfileThemeExternalSourceUrl(parsedUrl);

  if (isProfileThemeAudioFileUrl(parsedUrl)) {
    return buildSelection("Uploaded Audio", sourceUrl, {
      src: sourceUrl,
    });
  }

  return null;
};
const resolveProfileThemeSongSelection = (value: unknown): ProfileThemeSelection | null => {
  const presetKey = normalizeProfileThemePresetKey(value);

  if (presetKey) {
    const presetSelection = PROFILE_THEME_BY_KEY.get(presetKey);

    if (!presetSelection) {
      return null;
    }

    return {
      key: presetSelection.key,
      title: presetSelection.title,
      src: presetSelection.src,
    };
  }

  if (typeof value !== "string") {
    return null;
  }

  return resolveExternalProfileThemeSongSelection(value);
};
const normalizeProfileThemeSongKey = (value: unknown): string | null =>
  resolveProfileThemeSongSelection(value)?.key ?? null;

const PROFILE_CHANGE_COOLDOWN_DAYS = 30;
const PROFILE_CHANGE_COOLDOWN_MS = PROFILE_CHANGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

const getProfileFieldCooldown = (updatedAtStr: string | null | undefined) => {
  if (!updatedAtStr) return { isLocked: false, daysLeft: 0, unlockDate: null };
  const updatedAt = new Date(updatedAtStr).getTime();
  if (!Number.isFinite(updatedAt)) return { isLocked: false, daysLeft: 0, unlockDate: null };
  const diff = Date.now() - updatedAt;
  if (diff >= PROFILE_CHANGE_COOLDOWN_MS || diff < 0) return { isLocked: false, daysLeft: 0, unlockDate: null };
  const remainingMs = PROFILE_CHANGE_COOLDOWN_MS - diff;
  const daysLeft = Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
  const unlockDate = new Date(updatedAt + PROFILE_CHANGE_COOLDOWN_MS);
  return { isLocked: true, daysLeft, unlockDate };
};
const getAdminThemeSongInputValue = (value: string | null): string => {
  if (!value) {
    return "";
  }

  return value.toLowerCase().startsWith(PROFILE_THEME_EXTERNAL_URL_PREFIX)
    ? value.slice(PROFILE_THEME_EXTERNAL_URL_PREFIX.length)
    : value;
};
const SUPABASE_STORAGE_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET?.trim() || "comment-media";
const resolveSupabasePublicObjectPath = (value: string | null | undefined): string | null => {
  const rawValue = typeof value === "string" ? value.trim() : "";

  if (!rawValue) {
    return null;
  }

  try {
    const parsedUrl = new URL(rawValue);
    const pathSegments = parsedUrl.pathname.split("/").filter(Boolean);
    const storageIndex = pathSegments.findIndex(
      (segment) => segment === "storage"
    );

    if (storageIndex < 0) {
      return null;
    }

    const expectedPrefix = pathSegments.slice(storageIndex, storageIndex + 5);
    if (
      expectedPrefix[0] !== "storage" ||
      expectedPrefix[1] !== "v1" ||
      expectedPrefix[2] !== "object" ||
      expectedPrefix[3] !== "public"
    ) {
      return null;
    }

    const encodedBucket = expectedPrefix[4] ?? "";
    const decodedBucket = decodeURIComponent(encodedBucket);
    if (decodedBucket !== SUPABASE_STORAGE_BUCKET) {
      return null;
    }

    const objectSegments = pathSegments.slice(storageIndex + 5);
    if (!objectSegments.length) {
      return null;
    }

    return objectSegments.map((segment) => decodeURIComponent(segment)).join("/");
  } catch {
    return null;
  }
};
const hasCurrentFirebaseAuthRuntime = (runtime: RuntimeWindow) =>
  Boolean(runtime.sakuraFirebaseAuth) &&
  runtime.sakuraFirebaseRuntimeVersion === FIREBASE_AUTH_RUNTIME_VERSION &&
  runtime.sakuraFirebaseAuth?.__runtimeVersion === FIREBASE_AUTH_RUNTIME_VERSION;
const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : typeof error === "string" ? error : "";
const isNetworkFetchError = (error: unknown) =>
  error instanceof TypeError && /fetch|networkerror/i.test(error.message);
const isRecoverableStaleRuntimeError = (error: unknown) =>
  STALE_RUNTIME_ERROR_PATTERNS.some((pattern) => pattern.test(getErrorMessage(error)));
const recoverFromStaleRuntime = () => {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const recoveryCount = Number(
      window.sessionStorage.getItem(STALE_RUNTIME_RECOVERY_COUNT_STORAGE_KEY) || "0"
    );
    if (
      Number.isFinite(recoveryCount) &&
      recoveryCount >= STALE_RUNTIME_RECOVERY_MAX_PER_SESSION
    ) {
      return false;
    }

    const lastRecoveryAt = Number(
      window.sessionStorage.getItem(STALE_RUNTIME_RECOVERY_STORAGE_KEY) || "0"
    );

    if (
      Number.isFinite(lastRecoveryAt) &&
      Date.now() - lastRecoveryAt < STALE_RUNTIME_RECOVERY_COOLDOWN_MS
    ) {
      return false;
    }

    window.sessionStorage.setItem(
      STALE_RUNTIME_RECOVERY_STORAGE_KEY,
      String(Date.now())
    );
    window.sessionStorage.setItem(
      STALE_RUNTIME_RECOVERY_COUNT_STORAGE_KEY,
      String(Number.isFinite(recoveryCount) ? recoveryCount + 1 : 1)
    );
  } catch {}

  const runtime = getWindowState();
  delete runtime.sakuraFirebaseAuth;
  delete runtime.sakuraFirebaseAuthError;
  delete runtime.sakuraFirebaseRuntimeVersion;
  delete runtime.sakuraBootFirebaseAuth;
  delete runtime.sakuraStartFirebaseAuth;
  runtime.sakuraAuthStateSettled = false;

  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("__runtime_recover", String(Date.now()));
  window.location.replace(nextUrl.toString());
  return true;
};

const getAuthBridgeErrorMessage = (event: Event | undefined, fallback: string) => {
  if (typeof window !== "undefined" && getWindowState().sakuraFirebaseAuthError) {
    return getWindowState().sakuraFirebaseAuthError as string;
  }

  if (event instanceof CustomEvent) {
    if (typeof event.detail === "string" && event.detail) {
      return event.detail;
    }

    if (
      event.detail &&
      typeof event.detail === "object" &&
      "message" in event.detail &&
      typeof event.detail.message === "string" &&
      event.detail.message
    ) {
      return event.detail.message;
    }
  }

  return fallback;
};
const profilePath = (id: number) => `${repoBasePath}/profile/${id}`;
const getErrorCode = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : "";
const isPresenceOnlineNow = (presence: UserProfile["presence"] | null | undefined) => {
  const lastSeenAt = presence?.lastSeenAt ? Date.parse(presence.lastSeenAt) : Number.NaN;

  return Boolean(
    presence?.isOnline &&
      Number.isFinite(lastSeenAt) &&
      Date.now() - lastSeenAt <= PRESENCE_ACTIVE_WINDOW_MS
  );
};
const getProfileActionErrorMessage = (error: unknown, fallback: string) => {
  if (isNetworkFetchError(error)) {
    return "Storage is temporarily unreachable. Try again in a moment.";
  }

  const code = getErrorCode(error);

  if (code === "auth/too-many-requests") {
    return "Too many requests. Wait a little before retrying.";
  }

  if (code === "comments/login-required") {
    return "Sign in to leave a comment on this profile.";
  }

  if (code === "comments/delete-forbidden") {
    return "You can only delete your own comments, comments on your profile, or moderate comments with staff roles. Co-owner cannot remove root comments outside their profile.";
  }

  if (code === "comments/update-forbidden") {
    return "You can only edit your own comments unless you are root.";
  }

  if (code === "comments/media-unsupported") {
    return "Only PNG, JPG, WEBP, GIF, MP4, and WEBM files are supported in comments.";
  }

  if (code === "comments/media-too-large") {
    return "The selected media is too large. Use a smaller image or GIF.";
  }

  if (code === "comments/media-invalid") {
    return "The selected media could not be prepared for the comment.";
  }

  if (code === "comments/write-denied") {
    return "Comment media could not be saved. If attachments are enabled, allow mediaURL and mediaType in profileComments rules.";
  }

  if (code === "ban/self-forbidden") {
    return "You cannot ban your own account.";
  }

  if (code === "verification/self-forbidden") {
    return "You cannot revoke email verification on your own root account.";
  }

  if (code === "auth/account-banned") {
    return "This account has been banned by an administrator.";
  }

  if (code === "auth/email-not-verified") {
    return "Verify your email before using the profile and comments.";
  }

  if (code === "avatar/action-timeout") {
    return "Avatar action took too long. Try a smaller file.";
  }

  if (code === "auth/current-password-required") {
    return "Enter your current password.";
  }

  if (code === "auth/current-password-invalid") {
    return "Current password is incorrect.";
  }

  if (code === "auth/missing-email-for-password-reset") {
    return "This account has no linked email for password recovery.";
  }

  return error instanceof Error ? error.message : fallback;
};
const getCommentWriteDeniedMessage = (hasMedia: boolean) =>
  hasMedia
    ? "Comment media could not be saved. If attachments are enabled, allow mediaURL, mediaType, mediaPath, and mediaSize in profileComments rules."
    : "Comment could not be saved. Check Firestore rules for profileComments.";
const getSupabaseCommentMediaUnavailableMessage = () =>
  "Supabase media upload is not configured for this build yet. Add NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET to the deployed site build.";
const getSupabaseAvatarUnavailableMessage = () =>
  "Supabase avatar upload is not configured for this build yet. Add NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET to the deployed site build.";
const getSupabaseThemeMusicUnavailableMessage = () =>
  "Supabase music upload is not configured for this build yet. Add NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET to the deployed site build.";
const USER_AVATAR_UPGRADE_MESSAGE =
  "You need a profile upgrade to use GIFs and videos as your avatar. User and Test Period roles support static images only.";
const toCommentMediaPayload = (
  uploadResult: SupabaseCommentMediaUploadResult
): CommentMediaPayload => ({
  mediaURL: uploadResult.publicUrl,
  mediaType: uploadResult.contentType,
  mediaPath: uploadResult.path,
  mediaSize: uploadResult.size,
});
const toAvatarUploadPayload = (
  uploadResult: SupabaseCommentMediaUploadResult
): AvatarUploadPayload => ({
  photoURL: uploadResult.publicUrl,
  avatarType: uploadResult.contentType,
  avatarPath: uploadResult.path,
  avatarSize: uploadResult.size,
});
const shouldCleanupUploadedMedia = (uploadResult: SupabaseCommentMediaUploadResult | null) =>
  uploadResult ? Boolean(uploadResult.path) && !uploadResult.reused : false;
const isCommentVideoMediaType = (value: string | null | undefined) =>
  value === "video/mp4" || value === "video/webm";
const PREMIUM_AVATAR_MEDIA_TYPES = new Set(["image/gif", "video/mp4", "video/webm"]);
const formatAudioClock = (value: number) => {
  if (!Number.isFinite(value) || value < 0) {
    return "0:00";
  }

  const totalSeconds = Math.floor(value);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};
const buildMusicSliderStyle = (value: number, max: number) => {
  const safeMax = Number.isFinite(max) && max > 0 ? max : 1;
  const safeValue = Number.isFinite(value) ? Math.min(Math.max(value, 0), safeMax) : 0;
  const ratio = Math.min(100, Math.max(0, (safeValue / safeMax) * 100));

  return {
    background: `linear-gradient(90deg, rgba(255,183,197,0.98) 0%, rgba(255,183,197,0.98) ${ratio}%, rgba(42,23,28,0.95) ${ratio}%, rgba(42,23,28,0.95) 100%)`,
  } satisfies CSSProperties;
};
const musicSliderClassName =
  "h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#2a171c] " +
  "[&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full " +
  "[&::-webkit-slider-thumb]:mt-[-5px] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-[#ffd6df] [&::-webkit-slider-thumb]:bg-[#fff1f5] [&::-webkit-slider-thumb]:shadow-[0_0_16px_rgba(255,183,197,0.35)] " +
  "[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-transparent [&::-moz-range-track]:border-0 " +
  "[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-[#ffd6df] [&::-moz-range-thumb]:bg-[#fff1f5] [&::-moz-range-thumb]:shadow-[0_0_16px_rgba(255,183,197,0.35)] " +
  "disabled:cursor-not-allowed disabled:opacity-40";

function MusicGlyph({ playing }: { playing: boolean }) {
  if (playing) {
    return (
      <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-current">
        <rect x="3" y="2.5" width="3.2" height="11" rx="1.1" />
        <rect x="9.8" y="2.5" width="3.2" height="11" rx="1.1" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="ml-0.5 h-3.5 w-3.5 fill-current">
      <path d="M4 2.6c0-.55.6-.89 1.07-.61l8.03 4.84c.45.27.45.95 0 1.22L5.07 12.9A.71.71 0 0 1 4 12.3V2.6Z" />
    </svg>
  );
}

function CommentMediaFrame({
  src,
  mediaType,
  alt,
  className,
  controls = false,
}: {
  src: string;
  mediaType?: string | null;
  alt: string;
  className: string;
  controls?: boolean;
}) {
  if (isCommentVideoMediaType(mediaType)) {
    return (
      <video
        src={src}
        aria-label={alt}
        controls={controls}
        autoPlay={!controls}
        loop={!controls}
        muted
        playsInline
        preload="metadata"
        className={className}
      />
    );
  }

  return <img src={src} alt={alt} loading="lazy" decoding="async" fetchPriority="low" className={className} />;
}
const normalizeUsernameDraft = (value: string | null | undefined) =>
  String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .replace(/\s+/g, "");
const isEmailVerificationLockedForProfile = (user: UserProfile | null | undefined) =>
  Boolean(
    user &&
      !user.isAnonymous &&
      user.email &&
      user.emailVerified === false &&
      user.verificationRequired !== false
  );
const AVATAR_ACTION_TIMEOUT_MS = 12000;
const COMMENT_SUCCESS_DISMISS_MS = 1200;
const COMMENT_DELETE_SUCCESS_DISMISS_MS = 700;
const COMMENT_ERROR_DISMISS_MS = 1600;
const COMMENT_MEDIA_CHECK_TIMEOUT_MS = 6000;
const COMMENT_MEDIA_CHECK_CACHE_TTL_MS = 2 * 60 * 1000;
const withAvatarActionTimeout = <T,>(promise: Promise<T>) =>
  Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => {
        const error = new Error("Avatar action took too long. Try a smaller file.");
        (error as Error & { code?: string }).code = "avatar/action-timeout";
        reject(error);
      }, AVATAR_ACTION_TIMEOUT_MS);
    }),
  ]);
const parseProfileId = (path: string | null) => {
  if (!path || !path.startsWith(`${repoBasePath}/profile/`)) return null;
  const raw = path.slice(`${repoBasePath}/profile/`.length);
  return /^\d+$/.test(raw) ? Number(raw) : null;
};
const getStoredCurrentProfileId = () => {
  if (typeof window === "undefined") return null;
  try {
    const storedProfileId = window.sessionStorage.getItem(CURRENT_PROFILE_ID_STORAGE_KEY);
    return storedProfileId && /^\d+$/.test(storedProfileId) ? Number(storedProfileId) : null;
  } catch (error) {
    return null;
  }
};
const initialsFromText = (value: string) =>
  value
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2) || "CM";
const resolveProfileAvatarUrl = (profile: UserProfile | null | undefined) => {
  if (!profile) {
    return null;
  }

  const profileAvatarPath = typeof profile.avatarPath === "string" ? profile.avatarPath.trim() : "";
  if (profileAvatarPath) {
    return getSupabasePublicObjectUrl(profileAvatarPath);
  }

  const profilePhotoUrl = typeof profile.photoURL === "string" ? profile.photoURL.trim() : "";
  if (profilePhotoUrl) {
    return profilePhotoUrl;
  }

  if (typeof profile.profileId === "number" && profile.profileId > 0) {
    const cachedProfileSnapshot = readCachedProfileSnapshot<UserProfile>(profile.profileId);

    if (cachedProfileSnapshot) {
      const cachedAvatarPath =
        typeof cachedProfileSnapshot.avatarPath === "string"
          ? cachedProfileSnapshot.avatarPath.trim()
          : "";
      if (cachedAvatarPath) {
        return getSupabasePublicObjectUrl(cachedAvatarPath);
      }

      const cachedPhotoUrl =
        typeof cachedProfileSnapshot.photoURL === "string"
          ? cachedProfileSnapshot.photoURL.trim()
          : "";
      if (cachedPhotoUrl) {
        return cachedPhotoUrl;
      }
    }
  }

  return null;
};
const resolveProfileBannerUrl = (profile: UserProfile | null | undefined) => {
  if (!profile) {
    return null;
  }

  const profileBannerPath = typeof profile.bannerPath === "string" ? profile.bannerPath.trim() : "";
  if (profileBannerPath) {
    return getSupabasePublicObjectUrl(profileBannerPath);
  }

  const profileBannerUrl = typeof profile.bannerUrl === "string" ? profile.bannerUrl.trim() : "";
  if (profileBannerUrl) {
    return profileBannerUrl;
  }

  if (typeof profile.profileId === "number" && profile.profileId > 0) {
    const cachedProfileSnapshot = readCachedProfileSnapshot<UserProfile>(profile.profileId);

    if (cachedProfileSnapshot) {
      const cachedBannerPath =
        typeof cachedProfileSnapshot.bannerPath === "string"
          ? cachedProfileSnapshot.bannerPath.trim()
          : "";
      if (cachedBannerPath) {
        return getSupabasePublicObjectUrl(cachedBannerPath);
      }

      const cachedBannerUrl =
        typeof cachedProfileSnapshot.bannerUrl === "string"
          ? cachedProfileSnapshot.bannerUrl.trim()
          : "";
      if (cachedBannerUrl) {
        return cachedBannerUrl;
      }
    }
  }

  return null;
};
const resolveCommentMediaUrl = (
  comment: Pick<ProfileComment, "mediaPath" | "mediaURL">
) => {
  const mediaPath = typeof comment.mediaPath === "string" ? comment.mediaPath.trim() : "";

  if (mediaPath) {
    return getSupabasePublicObjectUrl(mediaPath);
  }

  const mediaURL = typeof comment.mediaURL === "string" ? comment.mediaURL.trim() : "";
  return mediaURL || null;
};
const COMMENT_RENDERABLE_IMAGE_MEDIA_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);
const isRenderableCommentImageMediaType = (value: string | null | undefined) =>
  typeof value === "string" &&
  COMMENT_RENDERABLE_IMAGE_MEDIA_TYPES.has(value.trim().toLowerCase());
const isRenderableCommentImagePath = (value: string | null | undefined) =>
  typeof value === "string" && /\.(jpe?g|png|webp)(?:$|[?#])/i.test(value.trim());
const isCommentMediaImageOrVideoType = (value: string | null | undefined) => {
  const normalizedValue = typeof value === "string" ? value.trim().toLowerCase() : "";
  return normalizedValue.startsWith("image/") || normalizedValue.startsWith("video/");
};
const isCommentMediaImageOrVideoPath = (value: string | null | undefined) =>
  typeof value === "string" && /\.(jpe?g|png|webp|gif|mp4|webm)(?:$|[?#])/i.test(value.trim());
const resolveCommentSupabaseMediaPath = (
  comment: Pick<ProfileComment, "mediaPath" | "mediaURL">
) => {
  const mediaPath = typeof comment.mediaPath === "string" ? comment.mediaPath.trim() : "";

  if (mediaPath) {
    return mediaPath;
  }

  const mediaURL = typeof comment.mediaURL === "string" ? comment.mediaURL.trim() : "";
  return resolveSupabasePublicObjectPath(mediaURL);
};
const isCommentPhotoOrVideoAttachment = (
  comment: Pick<ProfileComment, "mediaType" | "mediaPath" | "mediaURL">
) =>
  isCommentMediaImageOrVideoType(comment.mediaType) ||
  isCommentMediaImageOrVideoPath(resolveCommentSupabaseMediaPath(comment));
const resolveCommentMediaDisplayUrl = (
  comment: Pick<ProfileComment, "mediaPath" | "mediaType" | "mediaURL">
) => {
  const mediaPath = typeof comment.mediaPath === "string" ? comment.mediaPath.trim() : "";

  if (
    mediaPath &&
    (
      isRenderableCommentImageMediaType(comment.mediaType) ||
      isRenderableCommentImagePath(mediaPath)
    )
  ) {
    const renderedImageUrl = getSupabaseRenderedImageUrl(mediaPath, {
      width: 960,
      quality: 72,
      resize: "contain",
    });

    if (renderedImageUrl) {
      return renderedImageUrl;
    }
  }

  return resolveCommentMediaUrl(comment);
};
const hasProfileAvatarReference = (profile: UserProfile | null | undefined) =>
  Boolean(
    profile &&
      (
        (typeof profile.photoURL === "string" && profile.photoURL.trim()) ||
        (typeof profile.avatarPath === "string" && profile.avatarPath.trim())
      )
  );
const pickRicherProfileSnapshot = (
  preferredProfile: UserProfile | null | undefined,
  fallbackProfile: UserProfile | null | undefined
) => {
  if (preferredProfile && hasProfileAvatarReference(preferredProfile)) {
    return preferredProfile;
  }

  if (fallbackProfile && hasProfileAvatarReference(fallbackProfile)) {
    return fallbackProfile;
  }

  return preferredProfile ?? fallbackProfile ?? null;
};
const getCommentEditedBadgeText = (
  comment: Pick<ProfileComment, "updatedAt" | "updatedBy">
) => {
  if (!comment.updatedAt) {
    return null;
  }

  if (comment.updatedBy === "author") {
    return "Edited by author";
  }

  if (comment.updatedBy === "admin") {
    return "Edited by admin";
  }

  return "Edited";
};
const redirectToLocalProfile = (requestedProfileId: number, currentProfileId: number | null) => {
  if (typeof window === "undefined") return false;

  const localProfileId =
    typeof currentProfileId === "number" && currentProfileId > 0 ? currentProfileId : getStoredCurrentProfileId();

  if (localProfileId === null || localProfileId === requestedProfileId) {
    return false;
  }

  try {
    window.sessionStorage.removeItem(PROFILE_PATH_STORAGE_KEY);
  } catch (error) {}
  window.location.replace(profilePath(localProfileId));
  return true;
};
const resolveDateTimeLocale = (locale: UiLocale) => (locale === "ru" ? "ru-RU" : "en-US");
const formatTime = (value: string | null, locale: UiLocale) => {
  if (!value) {
    return locale === "ru" ? "Недоступно" : "Not available";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return locale === "ru" ? "Недоступно" : "Not available";
  }

  const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return new Intl.DateTimeFormat(resolveDateTimeLocale(locale), {
    dateStyle: "medium",
    timeStyle: "short",
    ...(browserTimeZone ? { timeZone: browserTimeZone } : {}),
  }).format(parsedDate);
};
const resolveProfileSubscriptionUntil = (profile: UserProfile | null | undefined) => {
  const value = typeof profile?.subscriptionUntil === "string" ? profile.subscriptionUntil.trim() : "";

  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate.toISOString();
};
const toDateTimeLocalInputValue = (value: string | null) => {
  if (!value) {
    return "";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  const pad = (candidate: number) => String(candidate).padStart(2, "0");

  return (
    String(parsedDate.getFullYear()) +
    "-" +
    pad(parsedDate.getMonth() + 1) +
    "-" +
    pad(parsedDate.getDate()) +
    "T" +
    pad(parsedDate.getHours()) +
    ":" +
    pad(parsedDate.getMinutes())
  );
};
const parseDateTimeLocalInputValue = (value: string): string | null => {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const parsedDate = new Date(trimmedValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate.toISOString();
};
const LIFETIME_SUBSCRIPTION_UNTIL_INPUT_VALUE = "3000-01-01T01:01";
const resolveProfileHwid = (profile: UserProfile | null | undefined) => {
  const value = typeof profile?.hwid === "string" ? profile.hwid.trim() : "";
  return value || null;
};
const isUserLikeRole = (role: string) => /^u(?:[\s_-]*s)?[\s_-]*e[\s_-]*r$/i.test(role.trim());
const toCompactRoleToken = (role: string) =>
  role
    .trim()
    .toLowerCase()
    .replace(/[\u0430]/g, "a")
    .replace(/[\u0435\u0451]/g, "e")
    .replace(/[\u043E]/g, "o")
    .replace(/[\u0440]/g, "p")
    .replace(/[\u0441]/g, "s")
    .replace(/[\u0443]/g, "y")
    .replace(/[\u0445]/g, "x")
    .replace(/[\u0456]/g, "i")
    .replace(/[^a-z0-9]+/g, "");
const normalizeRoleName = (role: string) => {
  const normalizedRole = role.trim().toLowerCase().replace(/\s+/g, " ");
  const compactRole = toCompactRoleToken(role);

  if (isUserLikeRole(role)) {
    return "user";
  }

  if (/^co[\s_-]*owner$/i.test(role.trim())) {
    return "co-owner";
  }

  if (compactRole === "admin" || compactRole === "administrator") {
    return "administrator";
  }

  if (compactRole === "superadministrator" || compactRole === "superadmin") {
    return "super administrator";
  }

  if (compactRole === "coowner") {
    return "co-owner";
  }

  if (
    compactRole === "root" ||
    compactRole === "r00t" ||
    compactRole === "owner"
  ) {
    return "root";
  }

  if (compactRole === "moderator") {
    return "moderator";
  }

  if (compactRole === "support" || compactRole === "supp0rt") {
    return "support";
  }

  if (
    compactRole === "sponsor" ||
    compactRole === "ponsor" ||
    compactRole === "sponor" ||
    compactRole === "ponor" ||
    compactRole === "sp0ns0r" ||
    compactRole === "p0n0r"
  ) {
    return "sponsor";
  }

  if (compactRole === "tester") {
    return "tester";
  }

  if (
    compactRole === "sakura" ||
    compactRole === "sakuradev" ||
    compactRole === "sakuracheat" ||
    role.includes("🌸") ||
    role.includes("\uD83C\uDF38")
  ) {
    return "sakura";
  }

  if (compactRole === "subscriber") {
    return "subscriber";
  }

  if (
    compactRole === "lifetime" ||
    compactRole === "lifetimesubscription" ||
    compactRole === "forever"
  ) {
    return "lifetime";
  }

  if (
    compactRole === "testperiod" ||
    compactRole === "trial" ||
    compactRole === "trialperiod"
  ) {
    return "test period";
  }

  if (compactRole === "banned" || compactRole === "ban") {
    return "banned";
  }

  if (compactRole === "user") {
    return "user";
  }

  return normalizedRole;
};
const cleanRoleLabel = (role: string) =>
  isUserLikeRole(role) ? "user" : role.trim().replace(/\s+/g, " ");
const formatRole = (role: string) => {
  const normalizedRole = normalizeRoleName(role);

  if (normalizedRole === "administrator") {
    return "administrator";
  }

  if (normalizedRole === "super administrator") {
    return "super administrator";
  }

  if (normalizedRole === "subscriber") {
    return "subscriber";
  }

  if (normalizedRole === "lifetime") {
    return "lifetime";
  }

  if (normalizedRole === "test period") {
    return "test period";
  }

  if (normalizedRole === "tester") {
    return "tester";
  }

  return cleanRoleLabel(role) || "user";
};
const roleDisplayLabel = (role: string) => {
  const normalizedRole = normalizeRoleName(role);

  if (normalizedRole === "root") {
    return "Root";
  }

  if (normalizedRole === "co-owner") {
    return "Co-Owner";
  }

  if (normalizedRole === "super administrator") {
    return "Super Administrator";
  }

  if (normalizedRole === "administrator") {
    return "Administrator";
  }

  if (normalizedRole === "moderator") {
    return "Moderator";
  }

  if (normalizedRole === "support") {
    return "Support";
  }

  if (normalizedRole === "sakura") {
    return "Sakura";
  }

  if (normalizedRole === "sponsor") {
    return "Sponsor";
  }

  if (normalizedRole === "tester") {
    return "Tester";
  }

  if (normalizedRole === "subscriber") {
    return "Subscriber";
  }

  if (normalizedRole === "lifetime") {
    return "Lifetime";
  }

  if (normalizedRole === "test period") {
    return "Test Period";
  }

  if (normalizedRole === "banned") {
    return "Banned";
  }

  if (normalizedRole === "user") {
    return "User";
  }

  return formatRole(role)
    .split(/([\s-]+)/)
    .map((part) =>
      /[\s-]+/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)
    )
    .join("");
};
const roleBadgeLabel = (role: string) => {
  const label = roleDisplayLabel(role);
  return label.replace(/[🌸\uD83C\uDF38]/gu, "").trim() || "Sakura";
};
const renderRoleBadgeText = (role: string): React.ReactNode => {
  const normalized = normalizeRoleName(role);
  const cleanLabel = roleBadgeLabel(role);
  const isSakuraRole =
    normalized === "sakura" ||
    /[🌸\uD83C\uDF38]/u.test(role) ||
    /sakura/i.test(role);

  if (isSakuraRole) {
    return (
      <span className="inline-flex items-center gap-1.5 text-gray-300">
        <SakuraIcon className="h-3.5 w-3.5 shrink-0 inline-block align-middle" stroke="#d1d5db" fill="#6b7280" />
        <span>{cleanLabel}</span>
      </span>
    );
  }

  return cleanLabel;
};
const roleBadgeTextStyle: CSSProperties = {
  fontFamily: "Arial, Helvetica, sans-serif",
  fontFeatureSettings: "\"liga\" 0, \"clig\" 0",
  fontVariantLigatures: "none",
  letterSpacing: "0.01em",
  lineHeight: 1.1,
  textTransform: "none",
  whiteSpace: "nowrap",
};
const roleBadgeStyle = (role: string): CSSProperties => {
  const normalizedRole = normalizeRoleName(role);

  if (normalizedRole === "banned") {
    return {
      borderColor: "#ff3b30",
      backgroundColor: "#220909",
      color: "#ffd5d2",
      boxShadow: "0 0 18px rgba(255,59,48,0.28)",
    };
  }

  if (
    normalizedRole === "root" ||
    normalizedRole === "super administrator" ||
    normalizedRole === "co-owner"
  ) {
    return {
      borderColor: "#ff3b30",
      backgroundColor: "#220909",
      color: "#ffd5d2",
      boxShadow: "0 0 18px rgba(255,59,48,0.28)",
    };
  }

  if (normalizedRole === "administrator") {
    return {
      borderColor: "#3b82f6",
      backgroundColor: "#081222",
      color: "#d6e7ff",
      boxShadow: "0 0 18px rgba(59,130,246,0.28)",
    };
  }

  if (normalizedRole === "support") {
    return {
      borderColor: "#22d3ee",
      backgroundColor: "#07181d",
      color: "#cffafe",
      boxShadow: "0 0 18px rgba(34,211,238,0.24)",
    };
  }

  if (normalizedRole === "moderator") {
    return {
      borderColor: "#4f7cff",
      backgroundColor: "#0a1328",
      color: "#d8e3ff",
      boxShadow: "0 0 18px rgba(79,124,255,0.24)",
    };
  }

  if (normalizedRole === "sakura") {
    return {
      borderColor: "#52525b",
      backgroundColor: "#18181b",
      color: "#d1d5db",
      boxShadow: "0 0 16px rgba(255, 255, 255, 0.08)",
    };
  }

  if (normalizedRole === "sponsor") {
    return {
      borderColor: "#8b5cf6",
      backgroundColor: "#161022",
      color: "#e3d8ff",
      boxShadow: "0 0 18px rgba(139,92,246,0.24)",
    };
  }

  if (normalizedRole === "tester") {
    return {
      borderColor: "#ffffff",
      backgroundColor: "#151515",
      color: "#ffffff",
      boxShadow: "0 0 18px rgba(255,255,255,0.2)",
    };
  }

  if (normalizedRole === "subscriber") {
    return {
      borderColor: "#fb923c",
      backgroundColor: "#1f1207",
      color: "#ffe1c2",
      boxShadow: "0 0 18px rgba(251,146,60,0.24)",
    };
  }

  if (normalizedRole === "lifetime") {
    return {
      borderColor: "#facc15",
      backgroundColor: "#1b1708",
      color: "#fff3c4",
      boxShadow: "0 0 18px rgba(250,204,21,0.24)",
    };
  }

  if (normalizedRole === "test period") {
    return {
      borderColor: "#e5e7eb",
      backgroundColor: "#151515",
      color: "#ffffff",
      boxShadow: "0 0 18px rgba(255,255,255,0.2)",
    };
  }

  return {
    borderColor: "#22c55e",
    backgroundColor: "#08170d",
    color: "#c6f6d5",
    boxShadow: "0 0 18px rgba(34,197,94,0.22)",
  };
};
const roleHeadlineStyle = (role: string | null | undefined): CSSProperties => {
  if (!role) {
    return {
      color: "#ffffff",
      textShadow: "0 0 18px rgba(255,255,255,0.08)",
    };
  }

  const badgeStyle = roleBadgeStyle(role);

  return {
    color: typeof badgeStyle.color === "string" ? badgeStyle.color : "#ffffff",
    textShadow: typeof badgeStyle.boxShadow === "string" ? badgeStyle.boxShadow : "0 0 18px rgba(255,255,255,0.08)",
  };
};
const withAlpha = (value: string, alpha: number) => {
  const normalized = value.trim();

  if (!normalized.startsWith("#")) {
    return value;
  }

  let hex = normalized.slice(1);

  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((part) => part + part)
      .join("");
  }

  if (hex.length !== 6) {
    return value;
  }

  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);

  if ([red, green, blue].some((channel) => Number.isNaN(channel))) {
    return value;
  }

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};
const profileMetaCardStyle = (role: string | null | undefined): CSSProperties => {
  const borderColor = "#ff8fb1";
  const accentTextColor = "#ffd3de";

  return {
    borderColor: withAlpha(borderColor, 0.4),
    backgroundColor: "#090909",
    backgroundImage: [
      `radial-gradient(circle at top left, ${withAlpha(borderColor, 0.14)} 0%, transparent 58%)`,
      `linear-gradient(180deg, ${withAlpha(accentTextColor, 0.04)} 0%, rgba(9,9,9,0) 100%)`,
    ].join(", "),
    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.03), 0 0 26px ${withAlpha(borderColor, 0.1)}`,
  };
};
const profileMetaLabelStyle = (role: string | null | undefined): CSSProperties => {
  const borderColor = "#ff8fb1";

  return {
    color: withAlpha(borderColor, 0.78),
    textShadow: `0 0 14px ${withAlpha(borderColor, 0.12)}`,
  };
};
const profileMetaValueStyle = (role: string | null | undefined): CSSProperties => {
  const accentTextColor = "#f3edf7";

  return {
    color: accentTextColor,
    fontFamily: "inherit",
    fontWeight: 500,
    letterSpacing: "0",
    textShadow: "none",
  };
};
const profileMetaValuePillStyle = (role: string | null | undefined): CSSProperties => {
  const borderColor = "#ff8fb1";

  return {
    borderColor: withAlpha(borderColor, 0.36),
    backgroundColor: "#171012",
    backgroundImage: `linear-gradient(180deg, ${withAlpha(borderColor, 0.1)} 0%, rgba(23,16,18,0.96) 100%)`,
    boxShadow: `0 0 22px ${withAlpha(borderColor, 0.12)}, inset 0 1px 0 rgba(255,255,255,0.04)`,
  };
};
const roleCommentAuthorColor = (role: string | null | undefined) => {
  const normalizedRole = normalizeRoleName(role ?? "");

  if (normalizedRole === "banned") {
    return "#ff5a54";
  }

  if (normalizedRole === "root") {
    return "#ff5a54";
  }

  if (normalizedRole === "co-owner") {
    return "#ff7a6f";
  }

  if (normalizedRole === "super administrator") {
    return "#4f7cff";
  }

  if (normalizedRole === "administrator") {
    return "#60a5fa";
  }

  if (normalizedRole === "support") {
    return "#67e8f9";
  }

  if (normalizedRole === "moderator") {
    return "#7c9cff";
  }

  if (normalizedRole === "sponsor") {
    return "#a78bfa";
  }

  if (normalizedRole === "tester") {
    return "#f3f4f6";
  }

  if (normalizedRole === "sakura") {
    return "#d1d5db";
  }

  if (normalizedRole === "subscriber") {
    return "#fb923c";
  }

  if (normalizedRole === "lifetime") {
    return "#facc15";
  }

  if (normalizedRole === "test period") {
    return "#f3f4f6";
  }

  return "#ffffff";
};
const roleCommentAuthorStyle = (role: string | null | undefined): CSSProperties => ({
  color: roleCommentAuthorColor(role),
});
const ROLE_MANAGER_NAMES = new Set([
  "root",
  "co-owner",
  "owner"
]);
const COMMENT_MODERATOR_ROLE_NAMES = new Set([
  "root",
  "co-owner",
  "super administrator",
  "administrator",
  "support",
  "moderator",
]);
const REMOVED_ROLE_NAMES = new Set<string>();
const SHOW_REFERRAL_PROGRAM = false;
const EDITABLE_ROLE_OPTIONS = [
  "root",
  "co-owner",
  "super administrator",
  "administrator",
  "moderator",
  "support",
  "sponsor",
  "sakura",
  "tester",
  "lifetime",
  "subscriber",
  "test period",
  "user",
];
const ROLE_DISPLAY_ORDER = new Map(
  EDITABLE_ROLE_OPTIONS.map((role, index) => [normalizeRoleName(role), index])
);
const COMMENT_AUTHOR_ROLE_ORDER = new Map([
  ["banned", 0],
  ["root", 0],
  ["co-owner", 1],
  ["super administrator", 2],
  ["administrator", 3],
  ["moderator", 4],
  ["support", 5],
  ["sponsor", 6],
  ["sakura", 6],
  ["tester", 7],
  ["lifetime", 8],
  ["subscriber", 9],
  ["test period", 10],
  ["user", 11],
]);
const sortRolesForDisplay = (roles: string[]) =>
  [...roles].sort((left, right) => {
    const leftOrder = ROLE_DISPLAY_ORDER.get(normalizeRoleName(left)) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = ROLE_DISPLAY_ORDER.get(normalizeRoleName(right)) ?? Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return formatRole(left).localeCompare(formatRole(right), "en");
  });
const normalizeRoleSelection = (roles: string[]) => {
  const nextRoles = roles
    .map((role) => normalizeRoleName(role))
    .filter(Boolean)
    .filter((role) => !REMOVED_ROLE_NAMES.has(role));

  const uniqueRoles = nextRoles.filter(
    (role, index, entries) => index === entries.findIndex((candidate) => candidate === role)
  );

  return uniqueRoles.length ? sortRolesForDisplay(uniqueRoles) : ["user"];
};
const pickCommentAuthorAccentRole = (roles: string[] | null | undefined) => {
  const nextRoles = Array.isArray(roles)
    ? roles
        .map((role) => normalizeRoleName(role))
        .filter(Boolean)
        .filter((role) => !REMOVED_ROLE_NAMES.has(role))
    : [];
  const uniqueRoles = nextRoles.filter(
    (role, index, entries) => index === entries.findIndex((candidate) => candidate === role)
  );
  const sortedRoles = [...uniqueRoles].sort((left, right) => {
    const leftOrder =
      COMMENT_AUTHOR_ROLE_ORDER.get(normalizeRoleName(left)) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder =
      COMMENT_AUTHOR_ROLE_ORDER.get(normalizeRoleName(right)) ?? Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return formatRole(left).localeCompare(formatRole(right), "en");
  });

  return sortedRoles[0] ?? null;
};
const canManageRoles = (roles: string[]) =>
  normalizeRoleSelection(roles).some((role) => ROLE_MANAGER_NAMES.has(normalizeRoleName(role)));
const hasRoleInSelection = (roles: string[] | null | undefined, expectedRole: string) =>
  normalizeRoleSelection(roles ?? []).some(
    (role) => normalizeRoleName(role) === normalizeRoleName(expectedRole)
  );
const canModerateComments = (roles: string[]) =>
  normalizeRoleSelection(roles).some((role) =>
    COMMENT_MODERATOR_ROLE_NAMES.has(normalizeRoleName(role))
  );
const canDeleteCommentAsModerator = (
  actor: Pick<UserProfile, "roles" | "profileId"> | null | undefined,
  comment: ProfileComment,
  commentAuthorRole: string | null | undefined
) => {
  if (!actor || !canModerateComments(actor.roles)) {
    return false;
  }

  if (hasRoleInSelection(actor.roles, "root")) {
    return true;
  }

  const ownsTargetProfile =
    typeof actor.profileId === "number" &&
    typeof comment.profileId === "number" &&
    actor.profileId === comment.profileId;

  if (
    hasRoleInSelection(actor.roles, "co-owner") &&
    normalizeRoleName(commentAuthorRole ?? "") === "root" &&
    !ownsTargetProfile
  ) {
    return false;
  }

  return true;
};
const deriveVisibleProfileRoles = (
  profile: Pick<UserProfile, "roles" | "isBanned"> | null | undefined
) => {
  if (profile?.isBanned === true) {
    return ["banned"];
  }

  return normalizeRoleSelection(profile?.roles ?? []);
};
const canUseEnhancedAvatarMediaForRoles = (roles: string[] | null | undefined) =>
  normalizeRoleSelection(roles ?? []).some((role) => {
    const normalizedRole = normalizeRoleName(role);
    return normalizedRole !== "user" && normalizedRole !== "test period";
  });
const profileNameOf = (user: Pick<UserProfile, "login" | "displayName" | "profileId">) =>
  user.displayName?.trim() ||
  user.login?.trim() ||
  (typeof user.profileId === "number" ? `Profile #${user.profileId}` : "Sakura User");
const profileSearchIdentityKey = (profile: UserProfile) =>
  profile.uid ||
  (typeof profile.profileId === "number" ? `profile:${profile.profileId}` : "");
const nameOf = (user: UserProfile) =>
  profileNameOf(user);
const createPendingCommentId = () =>
  `pending-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const initialsOf = (user: UserProfile) =>
  (nameOf(user) || user.email || (typeof user.profileId === "number" ? `Profile ${user.profileId}` : "SA"))
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);
const avatarErrorMessage = (error: unknown) => {
  if (error instanceof TypeError && /fetch/i.test(error.message)) {
    return "Avatar upload could not reach Supabase Storage. Check the bucket policy for comments/avatars and try again.";
  }

  return error instanceof Error ? error.message : "Avatar action failed.";
};
const getInitialRequestedProfileId = () => {
  if (typeof window === "undefined") return null;
  const fallback = window.sessionStorage.getItem(PROFILE_PATH_STORAGE_KEY);
  if (fallback) window.sessionStorage.removeItem(PROFILE_PATH_STORAGE_KEY);
  return parseProfileId(window.location.pathname) ?? parseProfileId(fallback);
};
const getClientCurrentUser = () =>
  typeof window === "undefined"
    ? null
    : getWindowState().sakuraCurrentUserSnapshot ??
      readCachedAuthSnapshot<UserProfile>() ??
      null;
const getClientProfile = (currentUser: UserProfile | null, requestedProfileId: number | null) =>
  currentUser && !currentUser.isAnonymous && (requestedProfileId === null || (currentUser.profileId ?? null) === requestedProfileId)
    ? currentUser
    : readCachedProfileSnapshot<UserProfile>(requestedProfileId);
const EMPTY_BOOTSTRAP = {
  authReady: false,
  authStateSettled: false,
  authError: null as string | null,
  currentUser: null as UserProfile | null,
  requestedProfileId: null as number | null,
  profile: null as UserProfile | null,
  comments: [] as ProfileComment[],
};
const getClientBootstrap = () => {
  const currentUser = getClientCurrentUser();
  const requestedProfileId = getInitialRequestedProfileId();
  const initialProfile = getClientProfile(currentUser, requestedProfileId);
  const currentUserProfileId =
    currentUser && !currentUser.isAnonymous && typeof currentUser.profileId === "number"
      ? currentUser.profileId
      : null;

  if (
    typeof window !== "undefined" &&
    requestedProfileId !== null &&
    window.location.pathname !== profilePath(requestedProfileId)
  ) {
    window.history.replaceState(null, "", profilePath(requestedProfileId));
  }

  if (
    typeof window !== "undefined" &&
    requestedProfileId === null &&
    currentUserProfileId !== null &&
    window.location.pathname === `${repoBasePath}/profile`
  ) {
    window.history.replaceState(null, "", profilePath(currentUserProfileId));
  }

  return {
    authReady:
      typeof window !== "undefined" && hasCurrentFirebaseAuthRuntime(getWindowState()),
    authStateSettled:
      typeof window !== "undefined" &&
      hasCurrentFirebaseAuthRuntime(getWindowState()) &&
      Boolean(getWindowState().sakuraAuthStateSettled),
    authError:
      typeof window === "undefined" ||
      (Boolean(getWindowState().sakuraFirebaseRuntimeVersion) &&
        getWindowState().sakuraFirebaseRuntimeVersion !== FIREBASE_AUTH_RUNTIME_VERSION)
        ? null
        : getWindowState().sakuraFirebaseAuthError ?? null,
    currentUser,
    requestedProfileId,
    profile: initialProfile,
    comments: readCachedProfileComments<ProfileComment>(
      initialProfile?.profileId ?? requestedProfileId
    ),
  };
};

export default function ProfilePage() {
  const { locale, t } = useLocaleText();
  const router = useRouter();
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);
  const adminAvatarInputRef = useRef<HTMLInputElement | null>(null);
  const adminBannerInputRef = useRef<HTMLInputElement | null>(null);
  const adminThemeSongFileInputRef = useRef<HTMLInputElement | null>(null);
  const [bootstrap] = useState(() => EMPTY_BOOTSTRAP);
  const [authReady, setAuthReady] = useState(bootstrap.authReady);
  const [authStateSettled, setAuthStateSettled] = useState(bootstrap.authStateSettled);
  const [authError, setAuthError] = useState<string | null>(bootstrap.authError);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(bootstrap.currentUser);
  const [profile, setProfile] = useState<UserProfile | null>(bootstrap.profile);
  const [requestedProfileId, setRequestedProfileId] = useState<number | null>(bootstrap.requestedProfileId);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [showPendingState, setShowPendingState] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);
  const [isAvatarDeleting, setIsAvatarDeleting] = useState(false);
  const [isBannerUploading, setIsBannerUploading] = useState(false);
  const [isBannerDeleting, setIsBannerDeleting] = useState(false);
  const [isVerificationSending, setIsVerificationSending] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarSuccess, setAvatarSuccess] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [bannerSuccess, setBannerSuccess] = useState<string | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [verificationSuccess, setVerificationSuccess] = useState<string | null>(null);
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [isDisplayNameSaving, setIsDisplayNameSaving] = useState(false);
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);
  const [displayNameSuccess, setDisplayNameSuccess] = useState<string | null>(null);
  const [usernameInput, setUsernameInput] = useState("");
  const [usernamePasswordInput, setUsernamePasswordInput] = useState("");
  const [isUsernameSaving, setIsUsernameSaving] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameSuccess, setUsernameSuccess] = useState<string | null>(null);
  const [currentPasswordInput, setCurrentPasswordInput] = useState("");
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [confirmNewPasswordInput, setConfirmNewPasswordInput] = useState("");
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);
  const [isPasswordResetSending, setIsPasswordResetSending] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [isProfileControlsOpen, setIsProfileControlsOpen] = useState(false);
  const [draftRoles, setDraftRoles] = useState<string[]>([]);
  const [isRolesSaving, setIsRolesSaving] = useState(false);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [rolesSuccess, setRolesSuccess] = useState<string | null>(null);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isClientMounted, setIsClientMounted] = useState(false);
  useEffect(() => {
    setIsClientMounted(true);
  }, []);
  const [adminPanelActiveTab, setAdminPanelActiveTab] = useState<"sub" | "roles" | "promos" | "security" | "edit">("sub");
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [editProfileActiveTab, setEditProfileActiveTab] = useState<"general" | "avatar" | "banner" | "security">("general");
  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState(false);
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [recoveryConfirmPassword, setRecoveryConfirmPassword] = useState("");
  const [recoverySaving, setRecoverySaving] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoverySuccess, setRecoverySuccess] = useState<string | null>(null);
  const [isBanSaving, setIsBanSaving] = useState(false);
  const [banError, setBanError] = useState<string | null>(null);
  const [banSuccess, setBanSuccess] = useState<string | null>(null);
  const [isAdminVerificationSaving, setIsAdminVerificationSaving] = useState(false);
  const [adminVerificationError, setAdminVerificationError] = useState<string | null>(null);
  const [adminVerificationSuccess, setAdminVerificationSuccess] = useState<string | null>(null);
  const [isAdminPasswordResetSending, setIsAdminPasswordResetSending] = useState(false);
  const [adminPasswordResetError, setAdminPasswordResetError] = useState<string | null>(null);
  const [adminPasswordResetSuccess, setAdminPasswordResetSuccess] = useState<string | null>(null);
  const [isAdminSubscriptionSaving, setIsAdminSubscriptionSaving] = useState(false);
  const [adminSubscriptionError, setAdminSubscriptionError] = useState<string | null>(null);
  const [adminSubscriptionSuccess, setAdminSubscriptionSuccess] = useState<string | null>(null);
  const [adminSubscriptionUntilInput, setAdminSubscriptionUntilInput] = useState("");
  const [isAdminSubscriptionUntilSaving, setIsAdminSubscriptionUntilSaving] = useState(false);
  const [adminSubscriptionUntilError, setAdminSubscriptionUntilError] = useState<string | null>(null);
  const [adminSubscriptionUntilSuccess, setAdminSubscriptionUntilSuccess] = useState<string | null>(null);
  const [isAdminHwidResetting, setIsAdminHwidResetting] = useState(false);
  const [adminHwidError, setAdminHwidError] = useState<string | null>(null);
  const [adminHwidSuccess, setAdminHwidSuccess] = useState<string | null>(null);
  const [adminThemeSongInput, setAdminThemeSongInput] = useState("");
  const [isAdminThemeSongSaving, setIsAdminThemeSongSaving] = useState(false);
  const [isAdminThemeSongUploading, setIsAdminThemeSongUploading] = useState(false);
  const [isAdminThemeSongDeleting, setIsAdminThemeSongDeleting] = useState(false);
  const [adminThemeSongError, setAdminThemeSongError] = useState<string | null>(null);
  const [adminThemeSongSuccess, setAdminThemeSongSuccess] = useState<string | null>(null);
  const [isAccountDeleting, setIsAccountDeleting] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);

  // Promo code redemption state
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
  const [isRedeemingPromo, setIsRedeemingPromo] = useState(false);
  const [promoErrorMessage, setPromoErrorMessage] = useState<string | null>(null);
  const [promoSuccessMessage, setPromoSuccessMessage] = useState<string | null>(null);
  const [hwidResetSent, setHwidResetSent] = useState(false);

  // Freeze state
  const [isFreezingSubscription, setIsFreezingSubscription] = useState(false);
  const [freezeErrorMessage, setFreezeErrorMessage] = useState<string | null>(null);
  const [freezeSuccessMessage, setFreezeSuccessMessage] = useState<string | null>(null);

  const [copiedReferral, setCopiedReferral] = useState(false);

  // Admin promo code management state
  const [adminPromoList, setAdminPromoList] = useState<any[]>([]);
  const [isAdminPromoLoading, setIsAdminPromoLoading] = useState(false);
  const [adminPromoCodeInput, setAdminPromoCodeInput] = useState("");
  const [adminPromoDaysInput, setAdminPromoDaysInput] = useState(30);
  const [adminPromoUsesInput, setAdminPromoUsesInput] = useState(1);
  const [adminPromoRoleInput, setAdminPromoRoleInput] = useState("subscriber");
  const [adminPromoNoteInput, setAdminPromoNoteInput] = useState("");
  const [isAdminPromoCreating, setIsAdminPromoCreating] = useState(false);
  const [adminPromoError, setAdminPromoError] = useState<string | null>(null);
  const [adminPromoSuccess, setAdminPromoSuccess] = useState<string | null>(null);
  const [adminCopiedPromoCode, setAdminCopiedPromoCode] = useState<string | null>(null);
  const [isAdminFreezeTargetSaving, setIsAdminFreezeTargetSaving] = useState(false);
  const [comments, setComments] = useState<ProfileComment[]>(bootstrap.comments);
  const [commentAuthorProfiles, setCommentAuthorProfiles] = useState<Record<number, UserProfile>>({});
  const [commentAuthorProfilesByCommentId, setCommentAuthorProfilesByCommentId] = useState<Record<string, UserProfile>>({});
  const [commentMentionProfilesByKey, setCommentMentionProfilesByKey] = useState<Record<string, UserProfile>>({});
  const [isCommentsLoading, setIsCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [commentInput, setCommentInput] = useState("");
  const [commentMediaFile, setCommentMediaFile] = useState<File | null>(null);
  const [commentMediaPreviewUrl, setCommentMediaPreviewUrl] = useState<string | null>(null);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [commentSuccess, setCommentSuccess] = useState<string | null>(null);
  const [isCommentSubmitting, setIsCommentSubmitting] = useState(false);
  const [activeMentionComposer, setActiveMentionComposer] = useState<MentionComposerMode | null>(null);
  const [mentionComposerActivityTick, setMentionComposerActivityTick] = useState(0);
  const [commentMentionCaret, setCommentMentionCaret] = useState(0);
  const [editingCommentMentionCaret, setEditingCommentMentionCaret] = useState(0);
  const [mentionSuggestions, setMentionSuggestions] = useState<UserProfile[]>([]);
  const [isMentionSuggestionsLoading, setIsMentionSuggestionsLoading] = useState(false);
  const [commentDraftMentionProfilesByKey, setCommentDraftMentionProfilesByKey] = useState<Record<string, UserProfile>>({});
  const [editingDraftMentionProfilesByKey, setEditingDraftMentionProfilesByKey] = useState<Record<string, UserProfile>>({});
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentMessage, setEditingCommentMessage] = useState("");
  const [editingCommentMediaFile, setEditingCommentMediaFile] = useState<File | null>(null);
  const [editingCommentMediaPreviewUrl, setEditingCommentMediaPreviewUrl] = useState<string | null>(null);
  const [isEditingCommentMediaRemoved, setIsEditingCommentMediaRemoved] = useState(false);
  const [isCommentUpdating, setIsCommentUpdating] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [confirmingCommentDeleteId, setConfirmingCommentDeleteId] = useState<string | null>(null);
  const [openCommentActionsMenuId, setOpenCommentActionsMenuId] = useState<string | null>(null);
  const [siteOnlineCount, setSiteOnlineCount] = useState<number | null>(null);
  const [profileThemeIsPlaying, setProfileThemeIsPlaying] = useState(false);
  const [profileThemeCurrentTime, setProfileThemeCurrentTime] = useState(0);
  const [profileThemeDuration, setProfileThemeDuration] = useState(0);
  const [profileThemeVolume, setProfileThemeVolume] = useState(0.34);
  const [isProfileThemePanelOpen, setIsProfileThemePanelOpen] = useState(false);
  const [previousProfileId, setPreviousProfileId] = useState<number | null | undefined>(undefined);
  const [nextProfileId, setNextProfileId] = useState<number | null | undefined>(undefined);
  const [isHeaderProfileSearchOpen, setIsHeaderProfileSearchOpen] = useState(false);
  const [headerProfileSearchQuery, setHeaderProfileSearchQuery] = useState("");
  const [headerProfileSearchResults, setHeaderProfileSearchResults] = useState<UserProfile[]>([]);
  const [headerProfileSearchError, setHeaderProfileSearchError] = useState<string | null>(null);
  const [headerProfileSearchFeedback, setHeaderProfileSearchFeedback] = useState<string | null>(null);
  const [isHeaderProfileSearchLoading, setIsHeaderProfileSearchLoading] = useState(false);
  const commentTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const profileThemeAudioRef = useRef<HTMLAudioElement | null>(null);
  const profileThemeEmbedFrameRef = useRef<HTMLIFrameElement | null>(null);
  const funPayTrackAudioRef = useRef<HTMLAudioElement | null>(null);
  const profileThemeAutoplayAttemptedRef = useRef<string | null>(null);
  const mentionSuggestionsCacheRef = useRef<Record<string, UserProfile[]>>({});
  const editingCommentTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const commentMediaInputRef = useRef<HTMLInputElement | null>(null);
  const editingCommentMediaInputRef = useRef<HTMLInputElement | null>(null);
  const ownerUsernameInputRef = useRef<HTMLInputElement | null>(null);
  const adminUsernameInputRef = useRef<HTMLInputElement | null>(null);
  const headerProfileSearchInputRef = useRef<HTMLInputElement | null>(null);
  const headerProfileSearchRequestIdRef = useRef(0);
  const prefetchedNeighborProfileIdsRef = useRef<Set<number>>(new Set());
  const prefetchingNeighborProfileIdsRef = useRef<Set<number>>(new Set());
  const prefetchedCommentAuthorProfileIdsRef = useRef<Set<number>>(new Set());
  const prefetchingCommentAuthorProfileIdsRef = useRef<Set<number>>(new Set());
  const commentMediaExistenceCacheRef = useRef<Map<string, { exists: boolean; expiresAt: number }>>(new Map());
  const staleCommentMediaCleanupInFlightRef = useRef<Set<string>>(new Set());
  const staleCommentMediaCleanupAttemptedRef = useRef<Set<string>>(new Set());
  const currentUserIdentitySignature = currentUser
    ? `${currentUser.uid}:${currentUser.isAnonymous ? "1" : "0"}:${currentUser.profileId ?? ""}`
    : "guest";
  const currentUserProfileSnapshotSignature = currentUser
    ? [
        currentUser.login ?? "",
        currentUser.displayName ?? "",
        currentUser.photoURL ?? "",
        currentUser.avatarPath ?? "",
        currentUser.roles?.join(",") ?? "",
        currentUser.emailVerified === false ? "0" : "1",
        currentUser.verificationRequired === false ? "0" : "1",
        currentUser.isBanned === true ? "1" : "0",
      ].join("|")
    : "none";

  const syncTextareaHeight = (element: HTMLTextAreaElement | null) => {
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  };

  const checkCommentSupabaseMediaExists = useCallback(async (mediaPath: string) => {
    if (!isSupabaseConfigured) {
      return true;
    }

    const normalizedMediaPath = mediaPath.trim();

    if (!normalizedMediaPath) {
      return true;
    }

    const now = Date.now();
    const cachedResult = commentMediaExistenceCacheRef.current.get(normalizedMediaPath);

    if (cachedResult && cachedResult.expiresAt > now) {
      return cachedResult.exists;
    }

    const mediaUrl = getSupabasePublicObjectUrl(normalizedMediaPath);

    if (!mediaUrl) {
      return true;
    }

    let exists = true;
    const abortController = typeof AbortController === "function" ? new AbortController() : null;
    const timeoutId = window.setTimeout(() => {
      abortController?.abort();
    }, COMMENT_MEDIA_CHECK_TIMEOUT_MS);

    try {
      const response = await fetch(mediaUrl, {
        method: "HEAD",
        cache: "no-store",
        signal: abortController?.signal,
      });

      exists = response.status !== 404 && response.status !== 410;
    } catch (error) {
      if (
        !(error instanceof DOMException && error.name === "AbortError") &&
        !isNetworkFetchError(error)
      ) {
        console.error("Failed to validate comment media object:", error);
      }
    } finally {
      window.clearTimeout(timeoutId);
    }

    commentMediaExistenceCacheRef.current.set(normalizedMediaPath, {
      exists,
      expiresAt: now + COMMENT_MEDIA_CHECK_CACHE_TTL_MS,
    });

    return exists;
  }, []);

  useEffect(() => {
    staleCommentMediaCleanupAttemptedRef.current.clear();
    staleCommentMediaCleanupInFlightRef.current.clear();
    commentMediaExistenceCacheRef.current.clear();
  }, [profile?.profileId]);

  useEffect(() => {
    if (!isHeaderProfileSearchOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsHeaderProfileSearchOpen(false);
        setHeaderProfileSearchError(null);
        setHeaderProfileSearchFeedback(null);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    window.requestAnimationFrame(() => {
      headerProfileSearchInputRef.current?.focus();
    });

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isHeaderProfileSearchOpen]);

  useEffect(() => {
    setHasHydrated(true);

    const nextBootstrap = getClientBootstrap();
    setAuthReady(nextBootstrap.authReady);
    setAuthStateSettled(nextBootstrap.authStateSettled);
    setAuthError(nextBootstrap.authError);
    setCurrentUser(nextBootstrap.currentUser);
    setRequestedProfileId(nextBootstrap.requestedProfileId);
    setProfile(nextBootstrap.profile);
    setComments(nextBootstrap.comments);
    setSiteOnlineCount(readCachedSiteOnlineCount());
  }, []);

  useEffect(() => {
    if (!profile || profile.isAnonymous) {
      return;
    }

    writeCachedProfileSnapshot(profile);
  }, [profile]);

  useEffect(() => {
    if (!profile?.profileId) {
      return;
    }

    writeCachedProfileComments(
      profile.profileId,
      comments.filter((comment) => comment.pending !== true)
    );
  }, [profile?.profileId, comments]);

  useEffect(() => {
    syncTextareaHeight(commentTextareaRef.current);
  }, [commentInput]);

  useEffect(() => {
    if (!commentMediaFile) {
      setCommentMediaPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(commentMediaFile);
    setCommentMediaPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [commentMediaFile]);

  useEffect(() => {
    syncTextareaHeight(editingCommentTextareaRef.current);
  }, [editingCommentId, editingCommentMessage]);

  useEffect(() => {
    if (!editingCommentMediaFile) {
      setEditingCommentMediaPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(editingCommentMediaFile);
    setEditingCommentMediaPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [editingCommentMediaFile]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const runtime = getWindowState();
    void runtime.sakuraBootFirebaseAuth?.();
    let unsubscribe: () => void = () => {};
    const sync = () => {
      if (hasCurrentFirebaseAuthRuntime(runtime) && runtime.sakuraFirebaseAuth) {
        try {
          const currentUrl = new URL(window.location.href);
          if (currentUrl.searchParams.has("__runtime_recover")) {
            currentUrl.searchParams.delete("__runtime_recover");
            window.history.replaceState(null, "", currentUrl.pathname + currentUrl.search + currentUrl.hash);
          }
        } catch {}
        setAuthReady(true);
        setAuthStateSettled(Boolean(runtime.sakuraAuthStateSettled));
        setAuthError(null);
        setCurrentUser(runtime.sakuraCurrentUserSnapshot ?? null);
        unsubscribe();
        unsubscribe = runtime.sakuraFirebaseAuth.onAuthStateChanged((user) => setCurrentUser(user));
        return;
      }
      if (
        runtime.sakuraFirebaseRuntimeVersion &&
        runtime.sakuraFirebaseRuntimeVersion !== FIREBASE_AUTH_RUNTIME_VERSION
      ) {
        setAuthReady(false);
        setAuthStateSettled(false);
        return;
      }
      if (runtime.sakuraFirebaseAuthError) setAuthError(runtime.sakuraFirebaseAuthError);
    };
    const onAuthStateSettled = () => {
      setAuthStateSettled(Boolean(getWindowState().sakuraAuthStateSettled));
    };
    const onUserUpdate = () => setCurrentUser(getWindowState().sakuraCurrentUserSnapshot ?? null);
    const onError = (event: Event) =>
      {
        const message = getAuthBridgeErrorMessage(
          event,
          "Auth is still loading. Reload the page if this does not clear soon."
        );

        if (isRecoverableStaleRuntimeError(message) && recoverFromStaleRuntime()) {
          return;
        }

        setAuthError(message);
      };
    const timeoutId = window.setTimeout(() => {
      const currentRuntime = getWindowState();
      if (
        !hasCurrentFirebaseAuthRuntime(currentRuntime) &&
        currentRuntime.sakuraFirebaseRuntimeVersion === FIREBASE_AUTH_RUNTIME_VERSION &&
        !currentRuntime.sakuraFirebaseAuthError
      )
        setAuthError("Auth is still loading. Reload the page if this does not clear soon.");
    }, 12000);
    sync();
    window.addEventListener(AUTH_READY_EVENT, sync);
    window.addEventListener(AUTH_ERROR_EVENT, onError);
    window.addEventListener(AUTH_STATE_SETTLED_EVENT, onAuthStateSettled);
    window.addEventListener(USER_UPDATE_EVENT, onUserUpdate);

    const handleOpenReset = () => {
      setIsRecoveryModalOpen(true);
      setRecoveryError(null);
      setRecoverySuccess(null);
      setRecoveryPassword("");
      setRecoveryConfirmPassword("");
    };

    window.addEventListener("sakura-open-password-reset", handleOpenReset);

    const checkPendingRecovery = () => {
      if (typeof window === "undefined") return;
      let hasPendingReset = false;
      try {
        hasPendingReset = window.sessionStorage.getItem("sakura_pending_password_reset") === "1";
      } catch {}

      if (
        window.location.hash.includes("type=recovery") ||
        window.location.search.includes("type=recovery") ||
        window.location.hash.includes("type=recovery_token") ||
        Boolean((window as any).sakuraIsPasswordRecovery) ||
        hasPendingReset
      ) {
        handleOpenReset();
      }
    };

    checkPendingRecovery();
    const tRecovery1 = window.setTimeout(checkPendingRecovery, 150);
    const tRecovery2 = window.setTimeout(checkPendingRecovery, 500);
    const tRecovery3 = window.setTimeout(checkPendingRecovery, 1200);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearTimeout(tRecovery1);
      window.clearTimeout(tRecovery2);
      window.clearTimeout(tRecovery3);
      window.removeEventListener(AUTH_READY_EVENT, sync);
      window.removeEventListener(AUTH_ERROR_EVENT, onError);
      window.removeEventListener(AUTH_STATE_SETTLED_EVENT, onAuthStateSettled);
      window.removeEventListener(USER_UPDATE_EVENT, onUserUpdate);
      window.removeEventListener("sakura-open-password-reset", handleOpenReset);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !authReady || authError) return;
    const runtime = getWindowState();
    const requestedId = requestedProfileId;
    const visibleCurrentUser = currentUser && !currentUser.isAnonymous ? currentUser : null;
    const canResolveProfile = requestedId !== null || authStateSettled;

    if (!canResolveProfile) {
      return;
    }

    if (isEmailVerificationLockedForProfile(visibleCurrentUser)) {
      setProfile(null);
      setProfileError(null);
      setIsProfileLoading(false);
      return;
    }
    if (requestedId === null || visibleCurrentUser?.profileId === requestedId) {
      setProfile(visibleCurrentUser);
      setProfileError(null);
      setIsProfileLoading(false);
      if (
        visibleCurrentUser?.profileId &&
        runtime.sakuraFirebaseAuth &&
        !resolveProfileAvatarUrl(visibleCurrentUser)
      ) {
        void runtime.sakuraFirebaseAuth
          .getProfileById(visibleCurrentUser.profileId)
          .then((snapshot) => {
            if (!snapshot) {
              return;
            }

            setProfile(snapshot);
            if (
              visibleCurrentUser &&
              snapshot.uid === visibleCurrentUser.uid
            ) {
              setCurrentUser(snapshot);
            }
            writeCachedProfileSnapshot(snapshot);
          })
          .catch(() => {});
      }
      if (visibleCurrentUser?.profileId && requestedId === null && window.location.pathname !== profilePath(visibleCurrentUser.profileId)) {
        window.history.replaceState(null, "", profilePath(visibleCurrentUser.profileId));
      }
      return;
    }
    if (!runtime.sakuraFirebaseAuth) return;
    const cachedRequestedProfile = readCachedProfileSnapshot<UserProfile>(requestedId);

    if (cachedRequestedProfile) {
      setProfile(cachedRequestedProfile);
      setProfileError(null);
    }

    setIsProfileLoading(!cachedRequestedProfile);
    setProfileError(null);
    runtime.sakuraFirebaseAuth
      .getProfileById(requestedId)
      .then((user) => {
        setProfile(user);
        if (!user) {
          clearCachedProfileSnapshot(requestedId);
          setProfile(null);
          setProfileError(
            locale === "ru"
              ? `Профиль #${requestedId} не найден или был удалён.`
              : `Profile #${requestedId} was not found or has been deleted.`
          );
          return;
        }
        if (window.location.pathname !== profilePath(requestedId)) window.history.replaceState(null, "", profilePath(requestedId));
      })
      .catch((error) => {
        if (isRecoverableStaleRuntimeError(error) && recoverFromStaleRuntime()) {
          return;
        }

        setProfile(null);
        setProfileError(error instanceof Error ? error.message : "Could not load this profile.");
      })
      .finally(() => setIsProfileLoading(false));
  }, [
    authReady,
    authStateSettled,
    authError,
    requestedProfileId,
    currentUserIdentitySignature,
    currentUserProfileSnapshotSignature,
  ]);

  useEffect(() => {
    if (
      !currentUser?.uid ||
      currentUser.isAnonymous ||
      isEmailVerificationLockedForProfile(currentUser) ||
      !getWindowState().sakuraFirebaseAuth
    ) return;
    getWindowState().sakuraFirebaseAuth?.syncPresence({ path: window.location.pathname, source: "profile-view", forceVisit: true }).catch(() => {});
  }, [currentUser?.uid, currentUser?.isAnonymous]);

  useEffect(() => {
    if (typeof window === "undefined" || !authReady) {
      return;
    }

    let isCancelled = false;
    let isRefreshing = false;
    let refreshDebounceTimeoutId: number | null = null;
    const refreshSiteOnlineCount = async () => {
      if (isRefreshing) {
        return;
      }

      const bridge = getWindowState().sakuraFirebaseAuth;

      if (!bridge) {
        return;
      }

      try {
        isRefreshing = true;
        const nextCount = await bridge.getSiteOnlineCount();

        if (!isCancelled) {
          setSiteOnlineCount((currentCount) =>
            currentCount === nextCount ? currentCount : nextCount
          );
          writeCachedSiteOnlineCount(nextCount);
        }
      } catch (error) {
      } finally {
        isRefreshing = false;
      }
    };

    const scheduleRefresh = () => {
      if (refreshDebounceTimeoutId !== null) {
        window.clearTimeout(refreshDebounceTimeoutId);
      }

      refreshDebounceTimeoutId = window.setTimeout(() => {
        refreshDebounceTimeoutId = null;
        void refreshSiteOnlineCount();
      }, SITE_ONLINE_COUNT_REFRESH_DEBOUNCE_MS);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "hidden") {
        scheduleRefresh();
      }
    };

    void refreshSiteOnlineCount();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "hidden") {
        return;
      }

      void refreshSiteOnlineCount();
    }, SITE_ONLINE_COUNT_REFRESH_INTERVAL_MS);

    window.addEventListener(USER_UPDATE_EVENT, scheduleRefresh);
    window.addEventListener(PRESENCE_DIRTY_EVENT, scheduleRefresh);
    window.addEventListener("pageshow", scheduleRefresh);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
      if (refreshDebounceTimeoutId !== null) {
        window.clearTimeout(refreshDebounceTimeoutId);
      }
      window.removeEventListener(USER_UPDATE_EVENT, scheduleRefresh);
      window.removeEventListener(PRESENCE_DIRTY_EVENT, scheduleRefresh);
      window.removeEventListener("pageshow", scheduleRefresh);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [authReady]);

  useEffect(() => {
    const activeProfileId = profile?.profileId;

    if (!authReady || authError || typeof activeProfileId !== "number") {
      setPreviousProfileId(undefined);
      setNextProfileId(undefined);
      return;
    }

    const bridge = getWindowState().sakuraFirebaseAuth;

    if (!bridge) {
      setPreviousProfileId(undefined);
      setNextProfileId(undefined);
      return;
    }

    let isCancelled = false;
    setPreviousProfileId(undefined);
    setNextProfileId(undefined);
    const resolveNeighborProfileId = async (startId: number, step: -1 | 1) => {
      let candidateProfileId = startId + step;

      for (
        let scanIndex = 0;
        scanIndex < PROFILE_NAV_SCAN_LIMIT && candidateProfileId > 0;
        scanIndex += 1, candidateProfileId += step
      ) {
        try {
          const candidateProfile = await bridge.getProfileById(candidateProfileId);

          if (candidateProfile && typeof candidateProfile.profileId === "number") {
            writeCachedProfileSnapshot(candidateProfile);
            return candidateProfile.profileId;
          } else {
            clearCachedProfileSnapshot(candidateProfileId);
          }
        } catch {
          clearCachedProfileSnapshot(candidateProfileId);
        }
      }

      return null;
    };

    void resolveNeighborProfileId(activeProfileId, -1).then(
      (resolvedPreviousProfileId) => {
        if (!isCancelled) {
          setPreviousProfileId(resolvedPreviousProfileId);
        }
      }
    );

    void resolveNeighborProfileId(activeProfileId, 1).then(
      (resolvedNextProfileId) => {
        if (!isCancelled) {
          setNextProfileId(resolvedNextProfileId);
        }
      }
    );

    return () => {
      isCancelled = true;
    };
  }, [authReady, authError, profile?.profileId]);

  useEffect(() => {
    if (!authReady || authError) {
      return;
    }

    const bridge = getWindowState().sakuraFirebaseAuth;

    if (!bridge) {
      return;
    }

    const currentProfileId = typeof profile?.profileId === "number" ? profile.profileId : null;
    if (!currentProfileId) {
      return;
    }

    let isCancelled = false;
    const prefetchProfileById = (neighborProfileId: number) => {
      if (
        prefetchedNeighborProfileIdsRef.current.has(neighborProfileId) ||
        prefetchingNeighborProfileIdsRef.current.has(neighborProfileId)
      ) {
        return;
      }

      prefetchingNeighborProfileIdsRef.current.add(neighborProfileId);

      void (async () => {
        let hasPrefetchedPayload = false;

        try {
          const prefetchedProfile = await bridge.getProfileById(neighborProfileId);

          if (prefetchedProfile && typeof prefetchedProfile.profileId === "number") {
            writeCachedProfileSnapshot(prefetchedProfile);
            hasPrefetchedPayload = true;
          }
        } catch {}

        try {
          const prefetchedComments = await bridge.getProfileComments(neighborProfileId);

          if (Array.isArray(prefetchedComments) && prefetchedComments.length > 0) {
            writeCachedProfileComments(
              neighborProfileId,
              prefetchedComments.filter((comment) => comment.pending !== true)
            );
            hasPrefetchedPayload = true;
          }
        } catch {}

        prefetchingNeighborProfileIdsRef.current.delete(neighborProfileId);

        if (hasPrefetchedPayload) {
          prefetchedNeighborProfileIdsRef.current.add(neighborProfileId);
        }
      })();
    };
    const resolveNeighborProfileIds = async (startId: number, step: -1 | 1, count: number) => {
      const resolvedProfileIds: number[] = [];
      let candidateProfileId = startId + step;

      for (
        let scanIndex = 0;
        scanIndex < PROFILE_NAV_SCAN_LIMIT &&
        candidateProfileId > 0 &&
        resolvedProfileIds.length < count;
        scanIndex += 1, candidateProfileId += step
      ) {
        const cachedCandidateProfile =
          readCachedProfileSnapshot<UserProfile>(candidateProfileId);

        if (
          cachedCandidateProfile &&
          typeof cachedCandidateProfile.profileId === "number" &&
          !resolvedProfileIds.includes(cachedCandidateProfile.profileId)
        ) {
          resolvedProfileIds.push(cachedCandidateProfile.profileId);
          continue;
        }

        try {
          const candidateProfile = await bridge.getProfileById(candidateProfileId);

          if (
            candidateProfile &&
            typeof candidateProfile.profileId === "number" &&
            !resolvedProfileIds.includes(candidateProfile.profileId)
          ) {
            resolvedProfileIds.push(candidateProfile.profileId);
          }
        } catch {}
      }

      return resolvedProfileIds;
    };

    void (async () => {
      const [leftNeighborProfileIds, rightNeighborProfileIds] = await Promise.all([
        resolveNeighborProfileIds(currentProfileId, -1, PROFILE_NAV_PREFETCH_PER_SIDE),
        resolveNeighborProfileIds(currentProfileId, 1, PROFILE_NAV_PREFETCH_PER_SIDE),
      ]);

      if (isCancelled) {
        return;
      }

      [...leftNeighborProfileIds, ...rightNeighborProfileIds].forEach((neighborProfileId) => {
        prefetchProfileById(neighborProfileId);
      });
    })();

    return () => {
      isCancelled = true;
    };
  }, [authReady, authError, profile?.profileId]);

  useEffect(() => {
    if (!authReady || !authStateSettled || authError || !comments.length) {
      return;
    }

    const bridge = getWindowState().sakuraFirebaseAuth;

    if (!bridge) {
      return;
    }

    const currentProfileId = typeof profile?.profileId === "number" ? profile.profileId : null;
    const commentAuthorProfileIds = [
      ...new Set(
        comments
          .map((comment) => comment.authorProfileId)
          .filter(
            (profileId): profileId is number =>
              typeof profileId === "number" &&
              profileId > 0 &&
              profileId !== currentProfileId
          )
      ),
    ].slice(0, 14);

    commentAuthorProfileIds.forEach((authorProfileId) => {
      if (
        prefetchedCommentAuthorProfileIdsRef.current.has(authorProfileId) ||
        prefetchingCommentAuthorProfileIdsRef.current.has(authorProfileId)
      ) {
        return;
      }

      prefetchingCommentAuthorProfileIdsRef.current.add(authorProfileId);

      void (async () => {
        let hasPrefetchedPayload = false;

        try {
          const prefetchedProfile = await bridge.getProfileById(authorProfileId);

          if (prefetchedProfile && typeof prefetchedProfile.profileId === "number") {
            writeCachedProfileSnapshot(prefetchedProfile);
            hasPrefetchedPayload = true;
          }
        } catch {}

        try {
          const prefetchedComments = await bridge.getProfileComments(authorProfileId);

          if (Array.isArray(prefetchedComments) && prefetchedComments.length > 0) {
            writeCachedProfileComments(
              authorProfileId,
              prefetchedComments.filter((comment) => comment.pending !== true)
            );
            hasPrefetchedPayload = true;
          }
        } catch {}

        prefetchingCommentAuthorProfileIdsRef.current.delete(authorProfileId);

        if (hasPrefetchedPayload) {
          prefetchedCommentAuthorProfileIdsRef.current.add(authorProfileId);
        }
      })();
    });
  }, [authReady, authStateSettled, authError, comments, profile?.profileId]);

  const visibleCurrentUser = currentUser && !currentUser.isAnonymous ? currentUser : null;
  const isCurrentAccountVerificationLocked = isEmailVerificationLockedForProfile(visibleCurrentUser);
  const isOwner = Boolean(
    visibleCurrentUser &&
      profile &&
      (visibleCurrentUser.uid === profile.uid ||
        (typeof visibleCurrentUser.profileId === "number" &&
          visibleCurrentUser.profileId > 0 &&
          visibleCurrentUser.profileId === profile.profileId) ||
        (visibleCurrentUser.email &&
          profile.email &&
          visibleCurrentUser.email.trim().toLowerCase() === profile.email.trim().toLowerCase()))
  );
  const activeProfile = profile;
  const activePresence =
    isOwner && visibleCurrentUser?.uid === activeProfile?.uid
      ? visibleCurrentUser?.presence ?? activeProfile?.presence ?? null
      : activeProfile?.presence ?? null;
  const profileThemeProfileId =
    typeof activeProfile?.profileId === "number" ? activeProfile.profileId : null;
  const isMusicAllowedForProfile =
    profileThemeProfileId === 2 || profileThemeProfileId === 3;
  const profileThemeStoredSelection =
    typeof profileThemeProfileId === "number" && isMusicAllowedForProfile
      ? resolveProfileThemeSongSelection(activeProfile?.themeSongKey)
      : null;
  const profileThemeDefaultSongKey =
    typeof profileThemeProfileId === "number" && isMusicAllowedForProfile
      ? PROFILE_THEME_DEFAULT_KEY_BY_PROFILE_ID.get(profileThemeProfileId) ?? null
      : null;
  const profileThemeDefaultSelection =
    typeof profileThemeProfileId === "number" && profileThemeDefaultSongKey && isMusicAllowedForProfile
      ? resolveProfileThemeSongSelection(profileThemeDefaultSongKey)
      : null;
  const profileThemeSelection = isMusicAllowedForProfile
    ? (profileThemeStoredSelection ?? profileThemeDefaultSelection)
    : null;
  const profileThemeSongSrc = profileThemeSelection?.src ?? null;
  const profileThemeEmbedUrl = profileThemeSelection?.embedUrl ?? null;
  const profileThemeSourceUrl = profileThemeSelection?.sourceUrl ?? null;
  const profileThemeEmbedHeight = profileThemeSelection?.embedHeight ?? 168;
  const profileThemeEmbedProvider = profileThemeSelection?.embedProvider ?? null;
  const profileThemeUsesEmbeddedPlayer = Boolean(profileThemeEmbedUrl);
  const profileThemeUsesFallbackEmbeddedTimeline =
    profileThemeEmbedProvider !== "soundcloud" &&
    profileThemeEmbedProvider !== "youtube" &&
    profileThemeEmbedProvider !== "vk";
  const profileThemeUsesNativeAudio = Boolean(profileThemeSongSrc);
  const profileThemeTitle = profileThemeSelection?.title ?? null;
  const profileThemeSongKey =
    profileThemeProfileId && profileThemeSelection
      ? `${profileThemeProfileId}:${profileThemeSelection.key}`
      : null;
  const shouldPlayProfileThemeSong = Boolean(profileThemeSongSrc || profileThemeEmbedUrl);
  const profileThemeActiveEmbedUrl =
    profileThemeUsesEmbeddedPlayer && profileThemeEmbedUrl ? profileThemeEmbedUrl : null;
  const shouldRenderHiddenThemeEmbed = Boolean(profileThemeActiveEmbedUrl);
  const profileThemeDisplayedDuration = profileThemeUsesEmbeddedPlayer
    ? profileThemeDuration > 0
      ? profileThemeDuration
      : PROFILE_THEME_EMBED_FALLBACK_DURATION_SECONDS
    : profileThemeDuration;
  const profileThemeDisplayedCurrentTime = Math.min(
    profileThemeCurrentTime,
    profileThemeDisplayedDuration || profileThemeCurrentTime
  );

  useEffect(() => {
    const audio = profileThemeAudioRef.current;

    if (!audio) {
      return;
    }

    audio.loop = true;

    if (!shouldPlayProfileThemeSong) {
      audio.pause();
      audio.currentTime = 0;
      setProfileThemeIsPlaying(false);
      setProfileThemeCurrentTime(0);
      setProfileThemeDuration(0);
      setIsProfileThemePanelOpen(false);
      profileThemeAutoplayAttemptedRef.current = null;
      return;
    }

    if (!profileThemeUsesNativeAudio) {
      audio.pause();
      audio.currentTime = 0;
      setProfileThemeIsPlaying(true);
      setProfileThemeCurrentTime(0);
      setProfileThemeDuration(
        profileThemeUsesFallbackEmbeddedTimeline
          ? PROFILE_THEME_EMBED_FALLBACK_DURATION_SECONDS
          : 0
      );
      profileThemeAutoplayAttemptedRef.current = profileThemeSongKey;
      return;
    }

    audio.volume = profileThemeVolume;

    if (profileThemeAutoplayAttemptedRef.current !== profileThemeSongKey) {
      profileThemeAutoplayAttemptedRef.current = profileThemeSongKey;
      void audio.play().catch(() => {
      });
    }

    return () => {
      audio.pause();
      audio.currentTime = 0;
      setProfileThemeIsPlaying(false);
      setProfileThemeCurrentTime(0);
      setProfileThemeDuration(0);
    };
  }, [
    profileThemeSongKey,
    profileThemeSongSrc,
    profileThemeUsesNativeAudio,
    profileThemeUsesFallbackEmbeddedTimeline,
    shouldPlayProfileThemeSong,
  ]);

  useEffect(() => {
    const audio = profileThemeAudioRef.current;

    if (!audio || !profileThemeUsesNativeAudio) {
      return;
    }

    audio.volume = profileThemeVolume;
  }, [profileThemeUsesNativeAudio, profileThemeVolume]);
  useEffect(() => {
    const audio = profileThemeAudioRef.current;

    if (!audio || !profileThemeUsesNativeAudio) {
      return;
    }

    let animationFrameId: number | null = null;
    const syncAudioState = (force = false) => {
      const nextIsPlaying = !audio.paused;
      const nextCurrentTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
      const nextDuration = Number.isFinite(audio.duration) ? audio.duration : 0;

      setProfileThemeIsPlaying((currentValue) =>
        currentValue === nextIsPlaying ? currentValue : nextIsPlaying
      );
      setProfileThemeCurrentTime((currentValue) =>
        force || Math.abs(currentValue - nextCurrentTime) >= PROFILE_THEME_TIMELINE_UPDATE_STEP_SECONDS
          ? nextCurrentTime
          : currentValue
      );
      setProfileThemeDuration((currentValue) =>
        force || Math.abs(currentValue - nextDuration) >= PROFILE_THEME_TIMELINE_UPDATE_STEP_SECONDS
          ? nextDuration
          : currentValue
      );
    };
    const syncAudioTimelineState = () => {
      if (animationFrameId !== null) {
        return;
      }

      animationFrameId = window.requestAnimationFrame(() => {
        animationFrameId = null;
        syncAudioState(false);
      });
    };

    const syncAudioStateImmediate = () => {
      syncAudioState(true);
    };

    syncAudioStateImmediate();
    audio.addEventListener("play", syncAudioStateImmediate);
    audio.addEventListener("pause", syncAudioStateImmediate);
    audio.addEventListener("timeupdate", syncAudioTimelineState);
    audio.addEventListener("loadedmetadata", syncAudioStateImmediate);
    audio.addEventListener("durationchange", syncAudioStateImmediate);
    audio.addEventListener("ended", syncAudioStateImmediate);

    return () => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }

      audio.removeEventListener("play", syncAudioStateImmediate);
      audio.removeEventListener("pause", syncAudioStateImmediate);
      audio.removeEventListener("timeupdate", syncAudioTimelineState);
      audio.removeEventListener("loadedmetadata", syncAudioStateImmediate);
      audio.removeEventListener("durationchange", syncAudioStateImmediate);
      audio.removeEventListener("ended", syncAudioStateImmediate);
    };
  }, [profileThemeSongSrc, profileThemeUsesNativeAudio]);

  useEffect(() => {
    if (!profileThemeUsesEmbeddedPlayer || !shouldPlayProfileThemeSong) {
      return;
    }

    setProfileThemeDuration((currentValue) =>
      currentValue > 0
        ? currentValue
        : profileThemeUsesFallbackEmbeddedTimeline
          ? PROFILE_THEME_EMBED_FALLBACK_DURATION_SECONDS
          : 0
    );
  }, [
    profileThemeSongKey,
    profileThemeUsesEmbeddedPlayer,
    profileThemeUsesFallbackEmbeddedTimeline,
    shouldPlayProfileThemeSong,
  ]);

  useEffect(() => {
    if (!profileThemeUsesEmbeddedPlayer || !profileThemeEmbedProvider) {
      return;
    }

    const normalizeSeconds = (rawValue: unknown): number | null => {
      if (typeof rawValue !== "number" || !Number.isFinite(rawValue) || rawValue < 0) {
        return null;
      }

      if (profileThemeEmbedProvider === "soundcloud") {
        return rawValue > 1000 ? rawValue / 1000 : rawValue;
      }

      return rawValue;
    };

    const syncDuration = (rawValue: unknown) => {
      const nextDuration = normalizeSeconds(rawValue);

      if (!nextDuration || nextDuration <= 0) {
        return;
      }

      setProfileThemeDuration((currentValue) =>
        Math.abs(currentValue - nextDuration) >= PROFILE_THEME_TIMELINE_UPDATE_STEP_SECONDS
          ? nextDuration
          : currentValue
      );
    };

    const syncCurrentTime = (rawValue: unknown) => {
      const nextTime = normalizeSeconds(rawValue);

      if (nextTime === null || nextTime < 0) {
        return;
      }

      setProfileThemeCurrentTime((currentValue) =>
        Math.abs(currentValue - nextTime) >= PROFILE_THEME_TIMELINE_UPDATE_STEP_SECONDS
          ? nextTime
          : currentValue
      );
    };

    const handleEmbedMessage = (event: MessageEvent) => {
      if (event.source !== profileThemeEmbedFrameRef.current?.contentWindow) {
        return;
      }

      let payload: unknown = event.data;

      if (typeof payload === "string") {
        try {
          payload = JSON.parse(payload);
        } catch {
          return;
        }
      }

      if (!payload || typeof payload !== "object") {
        return;
      }

      const message = payload as Record<string, unknown>;
      const messageEventName =
        typeof message.event === "string"
          ? message.event.toLowerCase()
          : typeof message.method === "string"
            ? message.method.toLowerCase()
            : "";
      const info =
        typeof message.info === "object" && message.info
          ? (message.info as Record<string, unknown>)
          : null;
      const data =
        typeof message.data === "object" && message.data
          ? (message.data as Record<string, unknown>)
          : null;
      const value =
        typeof message.value === "object" && message.value
          ? (message.value as Record<string, unknown>)
          : null;
      const numericValue =
        typeof message.value === "number" && Number.isFinite(message.value)
          ? message.value
          : null;
      const details = info ?? data ?? value;

      if (profileThemeEmbedProvider === "youtube" || profileThemeEmbedProvider === "vk") {
        const playbackState =
          typeof message.info === "number"
            ? message.info
            : typeof message.data === "number"
              ? message.data
              : null;

        if (messageEventName === "onstatechange") {
          if (playbackState === 1) {
            setProfileThemeIsPlaying(true);
          } else if (playbackState === 2 || playbackState === 0) {
            setProfileThemeIsPlaying(false);
          }
        }

        const infoPlaybackState =
          details && typeof details.playerState === "number"
            ? details.playerState
            : null;

        if (infoPlaybackState === 1) {
          setProfileThemeIsPlaying(true);
        } else if (infoPlaybackState === 2 || infoPlaybackState === 0) {
          setProfileThemeIsPlaying(false);
        }

        syncDuration(details?.duration ?? message.duration);
        syncCurrentTime(details?.currentTime ?? message.currentTime);
        return;
      }

      if (profileThemeEmbedProvider === "soundcloud") {
        if (messageEventName === "getduration" && numericValue !== null) {
          syncDuration(numericValue);
        }

        if (messageEventName === "getposition" && numericValue !== null) {
          syncCurrentTime(numericValue);
        }

        if (messageEventName === "play") {
          setProfileThemeIsPlaying(true);
        } else if (messageEventName === "pause" || messageEventName === "finish") {
          setProfileThemeIsPlaying(false);
        }

        const durationCandidate = details?.duration ?? message.duration;
        const currentCandidate =
          details?.currentPosition ??
          details?.currentTime ??
          details?.position ??
          message.currentPosition ??
          message.currentTime ??
          message.position;

        syncDuration(durationCandidate);
        syncCurrentTime(currentCandidate);
      }
    };

    window.addEventListener("message", handleEmbedMessage);

    return () => {
      window.removeEventListener("message", handleEmbedMessage);
    };
  }, [profileThemeEmbedProvider, profileThemeUsesEmbeddedPlayer]);

  useEffect(() => {
    if (!profileThemeUsesEmbeddedPlayer || !profileThemeEmbedProvider || !shouldPlayProfileThemeSong) {
      return;
    }

    let attemptCount = 0;
    const maxAttempts = 20;
    const intervalId = window.setInterval(() => {
      const frameWindow = profileThemeEmbedFrameRef.current?.contentWindow;

      attemptCount += 1;

      if (!frameWindow) {
        if (attemptCount >= maxAttempts) {
          window.clearInterval(intervalId);
        }
        return;
      }

      if (profileThemeEmbedProvider === "soundcloud") {
        const soundCloudEvents = ["READY", "PLAY", "PAUSE", "FINISH", "PLAY_PROGRESS"];

        for (const eventName of soundCloudEvents) {
          frameWindow.postMessage(JSON.stringify({ method: "addEventListener", value: eventName }), "*");
        }

        frameWindow.postMessage(
          JSON.stringify({ method: "setVolume", value: Math.round(profileThemeVolume * 100) }),
          "*"
        );
        frameWindow.postMessage(JSON.stringify({ method: "play" }), "*");
      } else if (profileThemeEmbedProvider === "youtube" || profileThemeEmbedProvider === "vk") {
        const messageId = "profile-theme-player";

        frameWindow.postMessage(JSON.stringify({ event: "listening", id: messageId }), "*");
        frameWindow.postMessage(
          JSON.stringify({
            event: "command",
            func: "setVolume",
            args: [Math.round(profileThemeVolume * 100)],
            id: messageId,
          }),
          "*"
        );
        frameWindow.postMessage(
          JSON.stringify({ event: "command", func: "playVideo", args: [], id: messageId }),
          "*"
        );
      }

      if (attemptCount >= maxAttempts) {
        window.clearInterval(intervalId);
      }
    }, 250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    profileThemeEmbedProvider,
    profileThemeSongKey,
    profileThemeUsesEmbeddedPlayer,
    profileThemeVolume,
    shouldPlayProfileThemeSong,
  ]);

  useEffect(() => {
    if (
      !profileThemeUsesEmbeddedPlayer ||
      !profileThemeEmbedProvider ||
      !shouldPlayProfileThemeSong
    ) {
      return;
    }

    const intervalId = window.setInterval(() => {
      const frameWindow = profileThemeEmbedFrameRef.current?.contentWindow;

      if (!frameWindow) {
        return;
      }

      if (profileThemeEmbedProvider === "soundcloud") {
        frameWindow.postMessage(JSON.stringify({ method: "getPosition" }), "*");
        frameWindow.postMessage(JSON.stringify({ method: "getDuration" }), "*");
        return;
      }

      if (profileThemeEmbedProvider === "youtube" || profileThemeEmbedProvider === "vk") {
        frameWindow.postMessage(
          JSON.stringify({ event: "command", func: "getCurrentTime", args: [] }),
          "*"
        );
        frameWindow.postMessage(
          JSON.stringify({ event: "command", func: "getDuration", args: [] }),
          "*"
        );
      }
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    profileThemeEmbedProvider,
    profileThemeSongKey,
    profileThemeUsesEmbeddedPlayer,
    shouldPlayProfileThemeSong,
  ]);

  useEffect(() => {
    if (
      !profileThemeUsesEmbeddedPlayer ||
      !profileThemeIsPlaying
    ) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setProfileThemeCurrentTime((currentValue) => {
        const maxDuration =
          profileThemeDuration > 0
            ? profileThemeDuration
            : PROFILE_THEME_EMBED_FALLBACK_DURATION_SECONDS;

        return currentValue >= maxDuration ? maxDuration : currentValue + 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    profileThemeDuration,
    profileThemeIsPlaying,
    profileThemeUsesEmbeddedPlayer,
  ]);

  const isActiveProfileOnline = isPresenceOnlineNow(activePresence);
  const hasUsername = Boolean(activeProfile?.login?.trim());
  const requiresUsernamePasswordConfirmation = Boolean(
    isOwner && visibleCurrentUser?.providerIds?.includes("password")
  );
  const profileRoles = deriveVisibleProfileRoles(activeProfile);
  const normalizedProfileRoleSet = new Set(profileRoles.map((role) => normalizeRoleName(role)));
  const hasSubscriberRole = normalizedProfileRoleSet.has("subscriber");
  const hasLifetimeRole = normalizedProfileRoleSet.has("lifetime");
  const hasTestPeriodRole = normalizedProfileRoleSet.has("test period");
  const isTrialSubscription = Boolean(
    hasTestPeriodRole ||
    (activeProfile?.hasClaimedTrial &&
      activeProfile?.activationHistory?.[0]?.type === "trial")
  );
  const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
  const lastFrozenAtStr =
    activeProfile?.lastFrozenAt ||
    activeProfile?.activationHistory?.find((item) => item.type === "freeze")?.activatedAt ||
    null;
  const lastFrozenTime = lastFrozenAtStr ? new Date(lastFrozenAtStr).getTime() : 0;
  const freezeCooldownRemainingMs = Math.max(0, ONE_MONTH_MS - (Date.now() - lastFrozenTime));
  const isFreezeOnCooldown = lastFrozenTime > 0 && freezeCooldownRemainingMs > 0;
  const freezeCooldownDays = Math.ceil(freezeCooldownRemainingMs / (24 * 60 * 60 * 1000));

  const hasPaidSubscriptionRole = hasSubscriberRole || hasLifetimeRole;
  const hasActiveSubscriptionRole = hasPaidSubscriptionRole || hasTestPeriodRole;
  const normalizedProfileRoles = profileRoles;
  const canUseEnhancedAvatarMedia = canUseEnhancedAvatarMediaForRoles(activeProfile?.roles);
  const topProfileRole = profileRoles[0] ?? null;
  const profileHeadlineStyle = roleHeadlineStyle(topProfileRole);
  const isCurrentAccountBanned = visibleCurrentUser?.isBanned === true;
  const subscriptionStatus = hasActiveSubscriptionRole ? "active" : "inactive";
  const subscriptionPlanLabel = hasLifetimeRole
    ? t("Lifetime", "Lifetime")
    : hasSubscriberRole
      ? t("Active Subscription", "Active Subscription")
      : hasTestPeriodRole
        ? t("Test Period", "Test Period")
        : t("No Subscription", "No Subscription");
  const subscriptionSummary = {
    title: subscriptionPlanLabel,
    status: subscriptionStatus,
    description: hasLifetimeRole
      ? ""
      : hasActiveSubscriptionRole
        ? t("Sakura Cheat Dota 2", "Sakura Cheat Dota 2")
        : t(
            "Buy a subscription to unlock all cheat features in the game.",
            "Buy a subscription to unlock all cheat features in the game."
          ),
  };
  const subscriptionBadgeStyle: CSSProperties =
    subscriptionSummary.status === "active"
      ? {
          borderColor: "#1f7a4d",
          backgroundColor: "#0d1713",
          color: "#8ce5b2",
          boxShadow: "0 0 18px rgba(31,122,77,0.24)",
        }
      : {
          borderColor: "#3a3a3a",
          backgroundColor: "#111111",
          color: "#a3a3a3",
          boxShadow: "0 0 14px rgba(0,0,0,0.32)",
        };
  const subscriptionTestPeriodBadgeStyle: CSSProperties = {
    borderColor: "#e5e7eb",
    backgroundColor: "#151515",
    color: "#ffffff",
    boxShadow: "0 0 16px rgba(255,255,255,0.18)",
  };
  const subscriptionLifetimeBadgeStyle: CSSProperties = {
    borderColor: "#facc15",
    backgroundColor: "#1b1708",
    color: "#fff3c4",
    boxShadow: "0 0 16px rgba(250,204,21,0.2)",
  };
  const subscriptionStatusLabel =
    subscriptionSummary.status === "active"
      ? t("Active", "Активна")
      : t("Inactive", "Неактивна");
  const profileSubscriptionUntil = resolveProfileSubscriptionUntil(activeProfile);
  const isProfileFrozen = activeProfile?.isFrozen === true;
  const calculateRemainingTime = (untilIso: string | null | undefined, isFrozen: boolean, frozenMs: number | null | undefined) => {
    if (isFrozen && typeof frozenMs === "number" && frozenMs > 0) {
      const totalSec = Math.floor(frozenMs / 1000);
      const days = Math.floor(totalSec / 86400);
      const hours = Math.floor((totalSec % 86400) / 3600);
      if (days > 0) return `${days} ${t("d.", "дн.")} ${hours} ${t("h.", "ч.")}`;
      const mins = Math.floor((totalSec % 3600) / 60);
      return `${hours} ${t("h.", "ч.")} ${mins} ${t("m.", "мин.")}`;
    }
    if (!untilIso) return null;
    const diffMs = new Date(untilIso).getTime() - Date.now();
    if (diffMs <= 0) return t("Expired", "Истекла");
    const totalSec = Math.floor(diffMs / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    if (days > 0) return `${days} ${t("d.", "дн.")} ${hours} ${t("h.", "ч.")}`;
    const mins = Math.floor((totalSec % 3600) / 60);
    return `${hours} ${t("h.", "ч.")} ${mins} ${t("m.", "мин.")}`;
  };
  const remainingTimePretty = calculateRemainingTime(profileSubscriptionUntil, isProfileFrozen, activeProfile?.frozenRemainingMs);
  const profileSubscriptionUntilLabel = hasLifetimeRole
    ? t("Lifetime", "Lifetime")
    : profileSubscriptionUntil
      ? formatTime(profileSubscriptionUntil, locale)
      : t("Not set", "Не указан");
  const profileHwid = resolveProfileHwid(activeProfile);
  const remainingDaysCount = (() => {
    if (hasLifetimeRole) return 999;
    if (isProfileFrozen && typeof activeProfile?.frozenRemainingMs === "number" && activeProfile.frozenRemainingMs > 0) {
      return Math.max(0, Math.floor(activeProfile.frozenRemainingMs / 86400000));
    }
    if (!profileSubscriptionUntil) return 0;
    const diffMs = new Date(profileSubscriptionUntil).getTime() - Date.now();
    return Math.max(0, Math.floor(diffMs / 86400000));
  })();
  const subscriptionProgressPercent = (() => {
    if (hasLifetimeRole) return 100;
    if (!hasActiveSubscriptionRole || remainingDaysCount <= 0) return 0;
    return Math.min(100, Math.max(10, Math.round((remainingDaysCount / 30) * 100)));
  })();
  const isOwnProfileViewById = Boolean(
    visibleCurrentUser &&
      typeof visibleCurrentUser.profileId === "number" &&
      activeProfile &&
      typeof activeProfile.profileId === "number" &&
      visibleCurrentUser.profileId === activeProfile.profileId
  );
  const shouldShowSubscriptionDetails =
    isOwner && isOwnProfileViewById && authReady && authStateSettled && !authError;
  const shouldShowVerificationBanner = Boolean(
    isOwner &&
      !activeProfile?.isBanned &&
      activeProfile?.email &&
      activeProfile.emailVerified === false &&
      activeProfile.verificationRequired !== false
  );
  const canManageRoleAssignments = Boolean(visibleCurrentUser && (visibleCurrentUser.profileId === 1 || canManageRoles(visibleCurrentUser.roles)));
  const actorIsRootManager = hasRoleInSelection(visibleCurrentUser?.roles ?? [], "root");
  const actorIsCoOwnerManager = hasRoleInSelection(visibleCurrentUser?.roles ?? [], "co-owner");
  const targetHasRootRole = hasRoleInSelection(activeProfile?.roles ?? [], "root");
  const isCoOwnerBlockedByRootTarget = Boolean(
    actorIsCoOwnerManager && !actorIsRootManager && targetHasRootRole
  );
  const canOpenAdminPanel = Boolean(
    canManageRoleAssignments &&
    activeProfile?.profileId &&
    !isCoOwnerBlockedByRootTarget
  );
  const isTargetBanned = activeProfile?.isBanned === true;
  const targetVerificationStatus = !activeProfile?.email
    ? "no-email"
    : activeProfile.emailVerified === true
      ? "verified"
      : activeProfile.emailVerified === false && activeProfile.verificationRequired !== false
        ? "locked"
        : "unknown";
  const isTargetVerificationLocked = targetVerificationStatus === "locked";
  const isTargetVerified = targetVerificationStatus === "verified";
  const isAdminSelfTarget = Boolean(canOpenAdminPanel && isOwner);
  const isAdminThemeSongDeleteLocked = Boolean(
    normalizeProfileThemePresetKey(adminThemeSongInput) ||
      normalizeProfileThemePresetKey(profileThemeSelection?.key)
  );
  const shouldRequireSettledAuthForView = requestedProfileId === null;
  const shouldShowPendingState =
    !authError &&
    !activeProfile &&
    (
      !authReady ||
      (shouldRequireSettledAuthForView && !authStateSettled) ||
      isProfileLoading ||
      (requestedProfileId !== null && !profileError)
    );

  useEffect(() => {
    setIsProfileControlsOpen(false);
    setUsernamePasswordInput("");
    setCurrentPasswordInput("");
    setNewPasswordInput("");
    setConfirmNewPasswordInput("");
    setPasswordError(null);
    setPasswordSuccess(null);
  }, [activeProfile?.profileId, isOwner]);

  useEffect(() => {
    if (!authReady || !authStateSettled || !isCurrentAccountVerificationLocked) {
      return;
    }

    const bridge = getWindowState().sakuraFirebaseAuth;

    if (!bridge) {
      router.replace("/");
      return;
    }

    let isCancelled = false;

    bridge
      .refreshVerificationStatus()
      .then((snapshot) => {
        if (isCancelled) {
          return;
        }

        setCurrentUser(snapshot);

        if (isEmailVerificationLockedForProfile(snapshot)) {
          router.replace("/");
        }
      })
      .catch(() => {
        if (!isCancelled) {
          router.replace("/");
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [authReady, authStateSettled, isCurrentAccountVerificationLocked, router]);

  useEffect(() => {
    if (!hasHydrated || !shouldShowPendingState) {
      setShowPendingState(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setShowPendingState(true);
    }, 180);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [hasHydrated, shouldShowPendingState]);

  const primaryName = activeProfile ? nameOf(activeProfile) : "Sakura User";
  const initials = activeProfile ? initialsOf(activeProfile) : "SA";
  const activeProfileAvatarUrl = resolveProfileAvatarUrl(activeProfile);
  const hasActiveProfileAvatar = Boolean(activeProfileAvatarUrl);
  const activeProfileBannerUrl = resolveProfileBannerUrl(activeProfile);
  const hasActiveProfileBanner = Boolean(activeProfileBannerUrl);
  const activeProfileRoleSignature = activeProfile?.roles?.join("|") ?? "";

  useEffect(() => {
    if (!activeProfile?.profileId) {
      return;
    }

    writeCachedProfileComments(
      activeProfile.profileId,
      comments.filter((comment) => comment.pending !== true)
    );
  }, [activeProfile?.profileId, comments]);

  const applyUpdatedProfileSnapshot = (snapshot: UserProfile | null) => {
    if (!snapshot) {
      return;
    }

    if (typeof snapshot.profileId === "number" && snapshot.profileId > 0) {
      writeCachedProfileSnapshot(snapshot);
    }

    const snapshotProfileId =
      typeof snapshot.profileId === "number" && snapshot.profileId > 0
        ? snapshot.profileId
        : null;
    const matchesSnapshot = (profile: UserProfile | null | undefined) =>
      Boolean(
        profile &&
          (
            profile.uid === snapshot.uid ||
            (snapshotProfileId !== null && profile.profileId === snapshotProfileId)
          )
      );

    if (matchesSnapshot(activeProfile)) {
      setProfile(snapshot);
    }

    if (matchesSnapshot(visibleCurrentUser)) {
      setCurrentUser(snapshot);
    }

    const resolvedSnapshotAvatarUrl = resolveProfileAvatarUrl(snapshot);

    setComments((currentComments) =>
      currentComments.map((comment) => {
        const matchesCommentAuthor =
          (typeof comment.authorUid === "string" && comment.authorUid === snapshot.uid) ||
          (snapshotProfileId !== null && comment.authorProfileId === snapshotProfileId);

        if (!matchesCommentAuthor) {
          return comment;
        }

        return {
          ...comment,
          authorPhotoURL: resolvedSnapshotAvatarUrl ?? null,
          authorAccentRole: pickCommentAuthorAccentRole(snapshot.roles) ?? comment.authorAccentRole,
        };
      })
    );

    if (snapshotProfileId !== null) {
      setCommentAuthorProfiles((currentProfiles) => ({
        ...currentProfiles,
        [snapshotProfileId]: snapshot,
      }));

      setCommentAuthorProfilesByCommentId((currentProfilesByCommentId) => {
        let hasChanges = false;
        const nextProfilesByCommentId: Record<string, UserProfile> = {};

        Object.entries(currentProfilesByCommentId).forEach(([commentId, profile]) => {
          if (
            profile &&
            (
              profile.uid === snapshot.uid ||
              profile.profileId === snapshotProfileId
            )
          ) {
            nextProfilesByCommentId[commentId] = snapshot;
            hasChanges = true;
            return;
          }

          nextProfilesByCommentId[commentId] = profile;
        });

        return hasChanges ? nextProfilesByCommentId : currentProfilesByCommentId;
      });
    }
  };
  const normalizeCommentAuthorKey = (value: string | null | undefined) =>
    typeof value === "string"
      ? value.trim().replace(/^@+/, "").toLocaleLowerCase().replace(/\s+/g, " ")
      : "";
  const isCommentMentionBoundary = (value: string | undefined) =>
    !value || !/[A-Za-z\u0400-\u04FF0-9._-]/.test(value);
  const extractCommentMentionKeys = (value: string | null | undefined) => {
    if (typeof value !== "string" || !value) {
      return [];
    }

    const mentionKeys: string[] = [];
    COMMENT_MENTION_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = COMMENT_MENTION_PATTERN.exec(value))) {
      const matchIndex = match.index;
      const nextIndex = matchIndex + match[0].length;
      const previousCharacter = matchIndex > 0 ? value[matchIndex - 1] : undefined;
      const nextCharacter = nextIndex < value.length ? value[nextIndex] : undefined;

      if (!isCommentMentionBoundary(previousCharacter) || !isCommentMentionBoundary(nextCharacter)) {
        continue;
      }

      const mentionKey = normalizeCommentAuthorKey(match[1]);

      if (mentionKey && !mentionKeys.includes(mentionKey)) {
        mentionKeys.push(mentionKey);
      }
    }

    return mentionKeys;
  };
  const isCommentMentionTokenCharacter = (value: string | null | undefined) =>
    Boolean(value) && COMMENT_MENTION_TOKEN_CHARACTER_PATTERN.test(value ?? "");
  const getCommentMentionDraft = (value: string, caret: number): MentionDraft | null => {
    if (!value || caret < 0 || caret > value.length) {
      return null;
    }

    const beforeCaret = value.slice(0, caret);
    const match = beforeCaret.match(COMMENT_MENTION_DRAFT_PATTERN);

    if (!match) {
      return null;
    }

    const query = normalizeCommentAuthorKey(match[2]);

    if (!query || query.length < 2) {
      return null;
    }

    let mentionEnd = beforeCaret.length;

    while (mentionEnd < value.length && isCommentMentionTokenCharacter(value[mentionEnd])) {
      mentionEnd += 1;
    }

    return {
      start: beforeCaret.length - match[2].length - 1,
      end: mentionEnd,
      query,
    };
  };
  const resolveMentionProfileRole = (profile: UserProfile | null | undefined) => {
    if (!profile) {
      return null;
    }

    if (profile.isBanned === true) {
      return "banned";
    }

    return pickCommentAuthorAccentRole(profile.roles) ?? null;
  };
  const renderProfileHoverPreview = (
    previewProfile: UserProfile,
    fallbackLabel: string,
    align: "center" | "start" = "center"
  ) => {
    const mentionProfileRole = resolveMentionProfileRole(previewProfile);
    const mentionPreviewName = profileNameOf(previewProfile);
    const mentionPreviewInitials = initialsOf(previewProfile);
    const mentionPreviewBadgeRole = deriveVisibleProfileRoles(previewProfile)[0] ?? "user";
    const mentionPreviewAlt = mentionPreviewName || fallbackLabel;
    const previewAlignmentClassName =
      align === "start" ? "left-0 translate-x-0" : "left-1/2 -translate-x-1/2";
    const previewArrowClassName =
      align === "start"
        ? "left-[28px] -translate-x-1/2"
        : "left-1/2 -translate-x-1/2";

    return (
      <span className={`absolute ${previewAlignmentClassName} top-full z-30 mt-3 w-[260px] translate-y-2 rounded-[22px] border border-[#2a2023] bg-[#0c0b0d] px-4 py-4 opacity-0 shadow-[0_18px_50px_rgba(0,0,0,0.46),0_0_35px_rgba(255,183,197,0.08)] transition duration-150 ease-out invisible group-hover/comment-profile:visible group-hover/comment-profile:translate-y-0 group-hover/comment-profile:opacity-100 group-focus-within/comment-profile:visible group-focus-within/comment-profile:translate-y-0 group-focus-within/comment-profile:opacity-100`}>
        <span className={`absolute ${previewArrowClassName} top-0 h-3 w-3 -translate-y-1/2 rotate-45 border-l border-t border-[#2a2023] bg-[#0c0b0d]`} />
        <span className="flex items-start gap-3">
          {resolveProfileAvatarUrl(previewProfile) ? (
            <AvatarMedia
              src={resolveProfileAvatarUrl(previewProfile) ?? ""}
              alt={mentionPreviewAlt}
              loading="lazy"
              decoding="async"
              className="h-12 w-12 shrink-0 rounded-[18px] border border-[#2a2022] object-cover shadow-[0_0_18px_rgba(255,183,197,0.12)]"
            />
          ) : (
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border border-[#2a2022] bg-[#171012] text-xs font-black uppercase text-[#ffb7c5] shadow-[0_0_18px_rgba(255,183,197,0.08)]">
              {mentionPreviewInitials}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <a
              href={typeof previewProfile.profileId === "number" ? profilePath(previewProfile.profileId) : "#"}
              style={roleCommentAuthorStyle(mentionProfileRole)}
              className="block truncate text-sm font-black uppercase tracking-[0.03em] transition hover:brightness-125 hover:text-white"
            >
              {mentionPreviewName}
            </a>
            <span className="mt-2 flex items-center justify-between gap-3">
              <span
                style={{ ...roleBadgeStyle(mentionPreviewBadgeRole), ...roleBadgeTextStyle }}
                className="inline-flex max-w-full items-center truncate whitespace-nowrap rounded-full border px-3 py-1 text-[10px] font-bold"
              >
                <span aria-hidden="true" className="inline-flex items-center truncate">
                  {renderRoleBadgeText(mentionPreviewBadgeRole)}
                </span>
              </span>
              {typeof previewProfile.profileId === "number" ? (
                <span
                  className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[10px] text-[#b78a95]"
                >
                  <span aria-hidden="true" className="inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-[#ff9fbd] shadow-[0_0_10px_rgba(255,159,189,0.7)]" />
                  <span className="truncate">UID: {previewProfile.profileId}</span>
                </span>
              ) : null}
            </span>
          </span>
        </span>
      </span>
    );
  };
  const resolveComposerMentionProfiles = (
    value: string,
    profilesByKey: Record<string, UserProfile>
  ) =>
    extractCommentMentionKeys(value)
      .map((mentionKey) => profilesByKey[mentionKey])
      .filter((profile): profile is UserProfile => Boolean(profile))
      .filter(
        (profile, index, profiles) =>
          index === profiles.findIndex((candidate) => candidate.uid === profile.uid)
      );
  const filterComposerMentionProfilesByValue = (
    value: string,
    profilesByKey: Record<string, UserProfile>
  ) => {
    const activeKeys = new Set(extractCommentMentionKeys(value));

    if (!activeKeys.size) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(profilesByKey).filter(([mentionKey]) => activeKeys.has(mentionKey))
    );
  };
  const removeMentionFromComposerValue = (value: string, login: string | null | undefined) => {
    const mentionKeyToRemove = normalizeCommentAuthorKey(login);

    if (!value || !mentionKeyToRemove) {
      return value;
    }

    const parts: string[] = [];
    COMMENT_MENTION_PATTERN.lastIndex = 0;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let removed = false;

    while ((match = COMMENT_MENTION_PATTERN.exec(value))) {
      const matchIndex = match.index;
      const nextIndex = matchIndex + match[0].length;
      const previousCharacter = matchIndex > 0 ? value[matchIndex - 1] : undefined;
      const nextCharacter = nextIndex < value.length ? value[nextIndex] : undefined;

      if (!isCommentMentionBoundary(previousCharacter) || !isCommentMentionBoundary(nextCharacter)) {
        continue;
      }

      const currentMentionKey = normalizeCommentAuthorKey(match[1]);

      if (currentMentionKey !== mentionKeyToRemove) {
        continue;
      }

      if (lastIndex < matchIndex) {
        parts.push(value.slice(lastIndex, matchIndex));
      }

      removed = true;
      lastIndex = nextIndex;
    }

    if (!removed) {
      return value;
    }

    if (lastIndex < value.length) {
      parts.push(value.slice(lastIndex));
    }

    return parts
      .join("")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .trim();
  };
  const removeMentionAttachment = (mode: MentionComposerMode, profile: UserProfile) => {
    const nextValue =
      mode === "new"
        ? removeMentionFromComposerValue(commentInput, profile.login)
        : removeMentionFromComposerValue(editingCommentMessage, profile.login);

    if (mode === "new") {
      setCommentInput(nextValue);
      setCommentDraftMentionProfilesByKey((currentProfiles) =>
        filterComposerMentionProfilesByValue(nextValue, currentProfiles)
      );
    } else {
      setEditingCommentMessage(nextValue);
      setEditingDraftMentionProfilesByKey((currentProfiles) =>
        filterComposerMentionProfilesByValue(nextValue, currentProfiles)
      );
    }

    window.requestAnimationFrame(() => {
      const nextTextarea =
        mode === "new" ? commentTextareaRef.current : editingCommentTextareaRef.current;

      if (!nextTextarea) {
        return;
      }

      nextTextarea.focus();
      nextTextarea.setSelectionRange(nextValue.length, nextValue.length);
      syncTextareaHeight(nextTextarea);
    });
  };
  const renderComposerMentionAttachments = (
    mode: MentionComposerMode,
    value: string,
    profilesByKey: Record<string, UserProfile>
  ) => {
    const mentionProfiles = resolveComposerMentionProfiles(value, profilesByKey);

    if (!mentionProfiles.length) {
      return null;
    }

    return (
      <div className="mt-3 rounded-[20px] border border-[#232323] bg-[#090909] px-4 py-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-gray-500">
          Attached Accounts
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {mentionProfiles.map((profile) => {
            const profileRole = resolveMentionProfileRole(profile);
            const profileBadgeRole = deriveVisibleProfileRoles(profile)[0] ?? "user";
            const profilePreviewName = profileNameOf(profile);
            const profilePreviewInitials = initialsOf(profile);
            const profileMentionLogin = profile.login ? `@${profile.login}` : profilePreviewName;
            const showProfileBadge = mode !== "edit";
            const profileSecondaryName =
              profilePreviewName && profilePreviewName !== profile.login
                ? profilePreviewName
                : null;

            return (
              <div
                key={`${mode}:${profile.uid}`}
                className="w-full min-w-0 overflow-hidden rounded-[18px] border border-[#2a2022] bg-[#120d11]"
              >
                <div className="flex min-w-0 items-stretch">
                  <a
                    href={typeof profile.profileId === "number" ? profilePath(profile.profileId) : "#"}
                    className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 transition hover:bg-[#171014]"
                  >
                  {resolveProfileAvatarUrl(profile) ? (
                    <AvatarMedia
                      src={resolveProfileAvatarUrl(profile) ?? ""}
                      alt={profilePreviewName}
                      loading="lazy"
                      decoding="async"
                        className="h-10 w-10 shrink-0 rounded-2xl border border-[#2a2022] object-cover"
                      />
                    ) : (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#2a2022] bg-[#171012] text-[11px] font-black uppercase text-[#ffb7c5]">
                        {profilePreviewInitials}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span
                        style={roleCommentAuthorStyle(profileRole)}
                        className="block truncate text-sm font-semibold"
                      >
                        {profileMentionLogin}
                      </span>
                      {profileSecondaryName ? (
                        <span className="mt-1 block truncate text-xs text-gray-400">
                          {profileSecondaryName}
                        </span>
                      ) : null}
                    </span>
                    {showProfileBadge ? (
                      <span
                        style={{ ...roleBadgeStyle(profileBadgeRole), ...roleBadgeTextStyle }}
                        className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-3 py-1 text-[10px] font-bold"
                      >
                        <span aria-hidden="true" className="inline-flex items-center">
                          {renderRoleBadgeText(profileBadgeRole)}
                        </span>
                      </span>
                    ) : null}
                  </a>
                  <button
                    type="button"
                    onClick={() => removeMentionAttachment(mode, profile)}
                    className="inline-flex min-w-[112px] shrink-0 items-center justify-center border-l border-[#2a2022] bg-[#140d11] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#ffb7c5] transition hover:bg-[#1a1115] hover:text-white"
                    aria-label={`Remove ${profilePreviewName} mention`}
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );

    return (
      <div className="mt-3 rounded-[20px] border border-[#232323] bg-[#090909] px-4 py-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-gray-500">
          Attached Accounts
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {mentionProfiles.map((profile) => {
            const profileRole = resolveMentionProfileRole(profile);
            const profileBadgeRole = deriveVisibleProfileRoles(profile)[0] ?? "user";
            const profilePreviewName = profileNameOf(profile);
            const profilePreviewInitials = initialsOf(profile);

            return (
              <div
                key={`${mode}:${profile.uid}`}
                className="group relative w-full min-w-0"
              >
                <a
                  href={typeof profile.profileId === "number" ? profilePath(profile.profileId) : "#"}
                  className="flex w-full min-w-0 items-center gap-3 rounded-[18px] border border-[#2a2022] bg-[#120d11] px-4 py-3 pr-16 transition hover:border-[#ffb7c5]/40 hover:bg-[#171014]"
                >
                  {resolveProfileAvatarUrl(profile) ? (
                    <AvatarMedia
                      src={resolveProfileAvatarUrl(profile) ?? ""}
                      alt={profilePreviewName}
                      loading="lazy"
                      decoding="async"
                      className="h-9 w-9 shrink-0 rounded-full border border-[#2a2022] object-cover"
                    />
                  ) : (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#2a2022] bg-[#171012] text-[10px] font-black uppercase text-[#ffb7c5]">
                      {profilePreviewInitials}
                    </span>
                  )}
                  <span className="min-w-0">
                    <span
                      style={roleCommentAuthorStyle(profileRole)}
                      className="block truncate text-xs font-semibold"
                    >
                      {profilePreviewName}
                    </span>
                    <span
                      style={{ ...roleBadgeStyle(profileBadgeRole), ...roleBadgeTextStyle }}
                      className="mt-1 inline-flex max-w-full items-center truncate whitespace-nowrap rounded-full border px-2.5 py-1 text-[9px] font-bold"
                    >
                      <span aria-hidden="true" className="inline-flex items-center truncate">
                        {renderRoleBadgeText(profileBadgeRole)}
                      </span>
                    </span>
                  </span>
                </a>
                <button
                  type="button"
                  onClick={() => removeMentionAttachment(mode, profile)}
                  className="absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-[#3a2a31] bg-[#140d11] text-[#ffb7c5] opacity-0 transition hover:border-[#ffb7c5]/40 hover:text-white group-hover:opacity-100"
                  aria-label={`Remove ${profilePreviewName} mention`}
                >
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute left-1/2 top-1/2 h-[1.5px] w-3.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full bg-current"
                  />
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute left-1/2 top-1/2 h-[1.5px] w-3.5 -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded-full bg-current"
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };
  const renderCommentMessageWithMentions = (value: string) => {
    const parts: ReactNode[] = [];
    COMMENT_MENTION_PATTERN.lastIndex = 0;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = COMMENT_MENTION_PATTERN.exec(value))) {
      const matchIndex = match.index;
      const nextIndex = matchIndex + match[0].length;
      const previousCharacter = matchIndex > 0 ? value[matchIndex - 1] : undefined;
      const nextCharacter = nextIndex < value.length ? value[nextIndex] : undefined;

      if (!isCommentMentionBoundary(previousCharacter) || !isCommentMentionBoundary(nextCharacter)) {
        continue;
      }

      if (lastIndex < matchIndex) {
        parts.push(value.slice(lastIndex, matchIndex));
      }

      const mentionLogin = match[1];
      const mentionKey = normalizeCommentAuthorKey(mentionLogin);
      const mentionProfile = mentionKey ? commentMentionProfilesByKey[mentionKey] : null;
      const mentionText = `@${mentionLogin}`;
      const mentionRole = resolveMentionProfileRole(mentionProfile);
      const mentionDisplayText = mentionProfile ? profileNameOf(mentionProfile) : mentionText;

      if (mentionProfile?.profileId) {
        parts.push(
          <span
            key={`${mentionKey}:${matchIndex}`}
            className="group/comment-profile relative inline-flex max-w-full align-baseline"
          >
            <a
              href={profilePath(mentionProfile.profileId)}
              style={roleCommentAuthorStyle(mentionRole)}
              className="inline-flex max-w-full items-baseline truncate font-semibold underline decoration-transparent transition duration-150 hover:brightness-125 hover:decoration-current focus-visible:decoration-current"
            >
              {mentionDisplayText}
            </a>
            {renderProfileHoverPreview(mentionProfile, mentionText)}
          </span>
        );
      } else {
        parts.push(mentionText);
      }

      lastIndex = nextIndex;
    }

    if (!parts.length) {
      return value;
    }

    if (lastIndex < value.length) {
      parts.push(value.slice(lastIndex));
    }

    return parts;
  };
  const updateMentionComposerCaret = (
    mode: MentionComposerMode,
    element: HTMLTextAreaElement | null
  ) => {
    if (!element) {
      return;
    }

    const nextCaret = element.selectionStart ?? element.value.length;
    setActiveMentionComposer(mode);

    if (mode === "new") {
      setCommentMentionCaret(nextCaret);
      return;
    }

    setEditingCommentMentionCaret(nextCaret);
  };
  const clearMentionSuggestions = () => {
    setMentionSuggestions([]);
    setIsMentionSuggestionsLoading(false);
  };
  const getActiveMentionDraft = (): MentionDraft | null => {
    if (activeMentionComposer === "edit") {
      return getCommentMentionDraft(editingCommentMessage, editingCommentMentionCaret);
    }

    if (activeMentionComposer === "new") {
      return getCommentMentionDraft(commentInput, commentMentionCaret);
    }

    return null;
  };
  const applyMentionSuggestion = (mode: MentionComposerMode, profile: UserProfile) => {
    const login = profile.login?.trim();

    if (!login) {
      return;
    }

    const textarea =
      mode === "new" ? commentTextareaRef.current : editingCommentTextareaRef.current;
    const currentValue = mode === "new" ? commentInput : editingCommentMessage;
    const currentCaret =
      textarea?.selectionStart ??
      (mode === "new" ? commentMentionCaret : editingCommentMentionCaret);
    const mentionDraft = getCommentMentionDraft(currentValue, currentCaret);

    if (!mentionDraft) {
      return;
    }

    const replacement = `@${login}`;
    const nextCharacter = currentValue[mentionDraft.end];
    const needsTrailingSpace = !nextCharacter;
    const nextValue = `${currentValue.slice(0, mentionDraft.start)}${replacement}${needsTrailingSpace ? " " : ""}${currentValue.slice(mentionDraft.end)}`;
    const nextCaret = mentionDraft.start + replacement.length + (needsTrailingSpace ? 1 : 0);

    if (mode === "new") {
      setCommentInput(nextValue);
      setCommentMentionCaret(nextCaret);
    } else {
      setEditingCommentMessage(nextValue);
      setEditingCommentMentionCaret(nextCaret);
    }

    clearMentionSuggestions();
    setActiveMentionComposer(mode);

    window.requestAnimationFrame(() => {
      const nextTextarea =
        mode === "new" ? commentTextareaRef.current : editingCommentTextareaRef.current;

      if (!nextTextarea) {
        return;
      }

      nextTextarea.focus();
      nextTextarea.setSelectionRange(nextCaret, nextCaret);
      syncTextareaHeight(nextTextarea);
    });
  };
  const renderMentionSuggestions = (mode: MentionComposerMode) => {
    if (activeMentionComposer !== mode) {
      return null;
    }

    const activeDraft = getActiveMentionDraft();

    if (!activeDraft) {
      return null;
    }

    if (!isMentionSuggestionsLoading && !mentionSuggestions.length) {
      return (
        <div className="mt-3 rounded-[20px] border border-[#232323] bg-[#090909] px-4 py-3">
          <p className="text-xs text-gray-500">No matching logins.</p>
        </div>
      );
    }

    return (
      <div className="mt-3 overflow-hidden rounded-[20px] border border-[#232323] bg-[#090909] shadow-[0_0_24px_rgba(255,183,197,0.06)]">
        <div className="border-b border-[#1b1b1b] px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-gray-500">
            Mention Suggestions
          </p>
        </div>
        {isMentionSuggestionsLoading ? (
          <div className="px-4 py-3">
            <p className="text-xs text-gray-500">Searching...</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {mentionSuggestions.map((profile) => {
              const mentionRole = resolveMentionProfileRole(profile);
              const mentionDisplayName = profile.displayName?.trim();
              const mentionNickname = profile.login ? `@${profile.login}` : "";
              const mentionPreviewInitials = initialsOf(profile);
              const mentionBadgeRole = deriveVisibleProfileRoles(profile)[0] ?? "user";

              return (
                <button
                  key={profile.uid}
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    applyMentionSuggestion(mode, profile);
                  }}
                  className="flex items-center gap-3 border-b border-[#171717] px-4 py-3 text-left transition last:border-b-0 hover:bg-[#120d11]"
                >
                  {resolveProfileAvatarUrl(profile) ? (
                    <AvatarMedia
                      src={resolveProfileAvatarUrl(profile) ?? ""}
                      alt={mentionDisplayName || mentionNickname}
                      loading="lazy"
                      decoding="async"
                      className="h-10 w-10 shrink-0 rounded-2xl border border-[#2a2022] object-cover"
                    />
                  ) : (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#2a2022] bg-[#171012] text-[11px] font-black uppercase text-[#ffb7c5]">
                      {mentionPreviewInitials}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span
                      style={roleCommentAuthorStyle(mentionRole)}
                      className="block truncate text-sm font-semibold"
                    >
                      {mentionNickname}
                    </span>
                    {mentionDisplayName ? (
                      <span className="mt-1 block truncate text-xs text-gray-400">
                        {mentionDisplayName}
                      </span>
                    ) : null}
                  </span>
                  <span
                    style={{ ...roleBadgeStyle(mentionBadgeRole), ...roleBadgeTextStyle }}
                    className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-3 py-1 text-[10px] font-bold"
                  >
                    <span aria-hidden="true" className="inline-flex items-center">
                      {renderRoleBadgeText(mentionBadgeRole)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };
  const commentMatchesUser = (comment: ProfileComment, user: UserProfile | null) => {
    if (!user) {
      return false;
    }

    if (comment.authorUid && comment.authorUid === user.uid) {
      return true;
    }

    if (
      typeof comment.authorProfileId === "number" &&
      typeof user.profileId === "number" &&
      comment.authorProfileId === user.profileId
    ) {
      return true;
    }

    const authorKey = normalizeCommentAuthorKey(comment.authorName);

    if (!authorKey) {
      return false;
    }

    const userKeys = [
      user.login,
      user.displayName,
      nameOf(user),
      typeof user.profileId === "number" ? `Profile #${user.profileId}` : null,
    ];

    return userKeys.some((value) => normalizeCommentAuthorKey(value) === authorKey);
  };
  const resolveCommentAuthorProfile = (comment: ProfileComment) => {
    const cachedCommentAuthorProfile = commentAuthorProfilesByCommentId[comment.id];
    if (activeProfile && commentMatchesUser(comment, activeProfile)) {
      return pickRicherProfileSnapshot(activeProfile, cachedCommentAuthorProfile);
    }

    if (visibleCurrentUser && commentMatchesUser(comment, visibleCurrentUser)) {
      return pickRicherProfileSnapshot(visibleCurrentUser, cachedCommentAuthorProfile);
    }

    if (cachedCommentAuthorProfile) {
      return cachedCommentAuthorProfile;
    }

    if (typeof comment.authorProfileId === "number") {
      const cachedCommentAuthorProfileByProfileId = commentAuthorProfiles[comment.authorProfileId];

      if (cachedCommentAuthorProfileByProfileId) {
        return cachedCommentAuthorProfileByProfileId;
      }

      const persistedCommentAuthorProfile =
        readCachedProfileSnapshot<UserProfile>(comment.authorProfileId);

      if (persistedCommentAuthorProfile) {
        return persistedCommentAuthorProfile;
      }
    }

    return null;
  };
  const resolveCommentAuthorRole = (comment: ProfileComment) => {
    const resolvedCommentAuthorProfile = resolveCommentAuthorProfile(comment);

    if (resolvedCommentAuthorProfile) {
      if (resolvedCommentAuthorProfile.isBanned === true) {
        return "banned";
      }

      return pickCommentAuthorAccentRole(resolvedCommentAuthorProfile.roles) ?? null;
    }

    if (comment.authorAccentRole) {
      const normalizedRole = normalizeRoleName(comment.authorAccentRole);
      return normalizedRole && !REMOVED_ROLE_NAMES.has(normalizedRole) ? normalizedRole : null;
    }

    return null;
  };
  const resolveCommentAuthorPhotoURL = (comment: ProfileComment) => {
    const resolvedCommentAuthorProfile = resolveCommentAuthorProfile(comment);

    const resolvedProfileAvatarUrl = resolveProfileAvatarUrl(resolvedCommentAuthorProfile);

    if (resolvedProfileAvatarUrl) {
      return resolvedProfileAvatarUrl;
    }

    if (comment.authorPhotoURL) {
      return comment.authorPhotoURL;
    }

    return null;
  };
  const canDeleteComment = (comment: ProfileComment) =>
    Boolean(
      visibleCurrentUser &&
        !isCurrentAccountVerificationLocked &&
        (() => {
          const ownsTargetProfile =
            isOwner &&
            typeof activeProfile?.profileId === "number" &&
            comment.profileId === activeProfile.profileId;
          const resolvedCommentAuthorRole = resolveCommentAuthorRole(comment);

          return (
            comment.authorUid === visibleCurrentUser.uid ||
            ownsTargetProfile ||
            canDeleteCommentAsModerator(
              {
                roles: visibleCurrentUser.roles,
                profileId: visibleCurrentUser.profileId,
              },
              comment,
              resolvedCommentAuthorRole
            )
          );
        })()
    );
  const canEditComment = (comment: ProfileComment) =>
    Boolean(
      visibleCurrentUser &&
        !isCurrentAccountVerificationLocked &&
        (comment.authorUid === visibleCurrentUser.uid ||
          canManageRoles(visibleCurrentUser.roles))
    );

  useEffect(() => {
    if (!activeProfile) {
      setDraftRoles([]);
      setRolesError(null);
      setRolesSuccess(null);
      setVerificationError(null);
      setVerificationSuccess(null);
      setAdminVerificationError(null);
      setAdminVerificationSuccess(null);
      setAdminPasswordResetError(null);
      setAdminPasswordResetSuccess(null);
      setAdminSubscriptionError(null);
      setAdminSubscriptionSuccess(null);
      setAdminSubscriptionUntilInput("");
      setAdminSubscriptionUntilError(null);
      setAdminSubscriptionUntilSuccess(null);
      setAdminHwidError(null);
      setAdminHwidSuccess(null);
      setAdminThemeSongInput("");
      setIsAdminThemeSongUploading(false);
      setIsAdminThemeSongDeleting(false);
      setAdminThemeSongError(null);
      setAdminThemeSongSuccess(null);
      setDeleteAccountError(null);
      setComments([]);
      setCommentAuthorProfiles({});
      setCommentAuthorProfilesByCommentId({});
      setCommentMentionProfilesByKey({});
      setCommentDraftMentionProfilesByKey({});
      setEditingDraftMentionProfilesByKey({});
      setCommentsError(null);
      setIsAdminPanelOpen(false);
      setBanError(null);
      setBanSuccess(null);
      setCommentInput("");
      setCommentError(null);
      setCommentSuccess(null);
      setCurrentPasswordInput("");
      setNewPasswordInput("");
      setConfirmNewPasswordInput("");
      setPasswordError(null);
      setPasswordSuccess(null);
      setActiveMentionComposer(null);
      setCommentMentionCaret(0);
      setEditingCommentMentionCaret(0);
      clearMentionSuggestions();
      setEditingCommentId(null);
      setEditingCommentMessage("");
      setEditingCommentMediaFile(null);
      setEditingCommentMediaPreviewUrl(null);
      setIsEditingCommentMediaRemoved(false);
      setIsCommentUpdating(false);
      setDeletingCommentId(null);
      setOpenCommentActionsMenuId(null);
      return;
    }

    setDraftRoles(normalizeRoleSelection(activeProfile.roles));
    setRolesError(null);
    setRolesSuccess(null);
    setVerificationError(null);
    setVerificationSuccess(null);
    setAdminVerificationError(null);
    setAdminVerificationSuccess(null);
    setAdminPasswordResetError(null);
    setAdminPasswordResetSuccess(null);
    setAdminSubscriptionError(null);
    setAdminSubscriptionSuccess(null);
    setAdminSubscriptionUntilInput(
      hasRoleInSelection(activeProfile.roles, "lifetime")
        ? ""
        : toDateTimeLocalInputValue(resolveProfileSubscriptionUntil(activeProfile))
    );
    setAdminSubscriptionUntilError(null);
    setAdminSubscriptionUntilSuccess(null);
    setAdminHwidError(null);
    setAdminHwidSuccess(null);
    setAdminThemeSongInput(
      getAdminThemeSongInputValue(
        normalizeProfileThemeSongKey(activeProfile.themeSongKey) ??
          (typeof activeProfile.profileId === "number"
            ? PROFILE_THEME_DEFAULT_KEY_BY_PROFILE_ID.get(activeProfile.profileId) ?? ""
            : "")
      )
    );
    setIsAdminThemeSongUploading(false);
    setIsAdminThemeSongDeleting(false);
    setAdminThemeSongError(null);
    setAdminThemeSongSuccess(null);
    setDeleteAccountError(null);
    setBanError(null);
    setBanSuccess(null);
    setDisplayNameInput(activeProfile.displayName ?? activeProfile.login ?? "");
    setDisplayNameError(null);
    setDisplayNameSuccess(null);
    setUsernameInput(activeProfile.login ?? "");
    setUsernameError(null);
    setUsernameSuccess(null);
    setCurrentPasswordInput("");
    setNewPasswordInput("");
    setConfirmNewPasswordInput("");
    setPasswordError(null);
    setPasswordSuccess(null);
    setCommentInput("");
    setCommentError(null);
    setCommentSuccess(null);
    setActiveMentionComposer(null);
    setCommentMentionCaret(0);
    setEditingCommentMentionCaret(0);
    clearMentionSuggestions();
    setCommentDraftMentionProfilesByKey({});
    setEditingDraftMentionProfilesByKey({});
    setEditingCommentId(null);
    setEditingCommentMessage("");
    setEditingCommentMediaFile(null);
    setEditingCommentMediaPreviewUrl(null);
    setIsEditingCommentMediaRemoved(false);
    setIsCommentUpdating(false);
    setDeletingCommentId(null);
    setOpenCommentActionsMenuId(null);
  }, [activeProfile, activeProfileRoleSignature]);

  useEffect(() => {
    if (!canOpenAdminPanel) {
      setIsAdminPanelOpen(false);
    }
  }, [canOpenAdminPanel]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.dispatchEvent(
      new CustomEvent(FLOATING_UI_VISIBILITY_EVENT, {
        detail: { hidden: isAdminPanelOpen },
      })
    );
  }, [isAdminPanelOpen]);

  useEffect(
    () => () => {
      if (typeof window === "undefined") {
        return;
      }

      window.dispatchEvent(
        new CustomEvent(FLOATING_UI_VISIBILITY_EVENT, {
          detail: { hidden: false },
        })
      );
    },
    []
  );

  useEffect(() => {
    if (!openCommentActionsMenuId) {
      return;
    }

    const isCommentStillVisible = comments.some((comment) => comment.id === openCommentActionsMenuId);

    if (!isCommentStillVisible) {
      setOpenCommentActionsMenuId(null);
    }
  }, [comments, openCommentActionsMenuId]);

  useEffect(() => {
    if (!commentSuccess) {
      return;
    }

    const dismissDelayMs = commentSuccess.toLowerCase().startsWith("comment deleted")
      ? COMMENT_DELETE_SUCCESS_DISMISS_MS
      : COMMENT_SUCCESS_DISMISS_MS;

    const timeoutId = window.setTimeout(() => {
      setCommentSuccess(null);
    }, dismissDelayMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [commentSuccess]);

  useEffect(() => {
    if (!commentError) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCommentError(null);
    }, COMMENT_ERROR_DISMISS_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [commentError]);

  useEffect(() => {
    if (!openCommentActionsMenuId) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (!(target instanceof Element)) {
        setOpenCommentActionsMenuId(null);
        return;
      }

      if (target.closest("[data-comment-actions-menu]")) {
        return;
      }

      setOpenCommentActionsMenuId(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenCommentActionsMenuId(null);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [openCommentActionsMenuId]);

  useEffect(() => {
    if (typeof window === "undefined" || !authReady || !authStateSettled || authError || !activeProfile?.profileId) {
      if (!activeProfile?.profileId) {
        setComments([]);
        setCommentAuthorProfiles({});
        setCommentAuthorProfilesByCommentId({});
        setCommentsError(null);
        setIsCommentsLoading(false);
      }
      return;
    }

    const bridge = getWindowState().sakuraFirebaseAuth;
    if (!bridge) return;

    let isCancelled = false;
    const cachedComments = readCachedProfileComments<ProfileComment>(activeProfile.profileId);

    setComments(cachedComments);
    setIsCommentsLoading(!cachedComments.length);
    setCommentsError(null);

    bridge
      .getProfileComments(activeProfile.profileId)
      .then((nextComments) => {
        if (isCancelled) return;
        if (!nextComments.length && cachedComments.length) {
          setComments(cachedComments);
          return;
        }
        setComments(nextComments);
      })
      .catch((error) => {
        if (isCancelled) return;
        if (!cachedComments.length) {
          setComments([]);
          setCommentsError(getProfileActionErrorMessage(error, "Could not load profile comments."));
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsCommentsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [activeProfile?.profileId, authReady, authStateSettled, authError]);

  useEffect(() => {
    if (!authReady || !authStateSettled || authError || !activeProfile?.profileId || !comments.length) {
      return;
    }

    const bridge = getWindowState().sakuraFirebaseAuth;

    if (!bridge) {
      return;
    }

    const cleanupTargets = comments.filter((comment) => {
      if (comment.pending === true || editingCommentId === comment.id) {
        return false;
      }

      if (
        staleCommentMediaCleanupAttemptedRef.current.has(comment.id) ||
        staleCommentMediaCleanupInFlightRef.current.has(comment.id)
      ) {
        return false;
      }

      return Boolean(resolveCommentSupabaseMediaPath(comment)) && isCommentPhotoOrVideoAttachment(comment);
    });

    if (!cleanupTargets.length) {
      return;
    }

    let isCancelled = false;

    void (async () => {
      for (const targetComment of cleanupTargets) {
        if (isCancelled) {
          return;
        }

        const mediaPath = resolveCommentSupabaseMediaPath(targetComment);

        if (!mediaPath) {
          continue;
        }

        const mediaExists = await checkCommentSupabaseMediaExists(mediaPath);

        if (isCancelled || mediaExists) {
          continue;
        }

        staleCommentMediaCleanupAttemptedRef.current.add(targetComment.id);
        staleCommentMediaCleanupInFlightRef.current.add(targetComment.id);

        try {
          const normalizedMessage =
            typeof targetComment.message === "string" ? targetComment.message.trim() : "";

          if (!normalizedMessage) {
            const deletedCommentId = await bridge.deleteProfileComment(targetComment.id);
            const resolvedCommentId = deletedCommentId ?? targetComment.id;

            if (!isCancelled) {
              setComments((currentComments) =>
                currentComments.filter((comment) => comment.id !== resolvedCommentId)
              );
            }

            continue;
          }

          const updatedComment = await bridge.updateProfileComment(
            targetComment.id,
            targetComment.message,
            null,
            true
          );

          if (isCancelled) {
            return;
          }

          if (!updatedComment) {
            setComments((currentComments) =>
              currentComments.filter((comment) => comment.id !== targetComment.id)
            );
            continue;
          }

          setComments((currentComments) =>
            currentComments.map((comment) =>
              comment.id === updatedComment.id ? updatedComment : comment
            )
          );
        } catch (error) {
          console.error("Failed to cleanup missing comment media from database:", error);
        } finally {
          staleCommentMediaCleanupInFlightRef.current.delete(targetComment.id);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [
    activeProfile?.profileId,
    authReady,
    authStateSettled,
    authError,
    comments,
    editingCommentId,
    checkCommentSupabaseMediaExists,
  ]);

  useEffect(() => {
    if (!comments.length) {
      setCommentAuthorProfiles({});
      setCommentAuthorProfilesByCommentId({});
      setCommentMentionProfilesByKey({});
      return;
    }

    const bridge = getWindowState().sakuraFirebaseAuth;

    if (!bridge) {
      setCommentAuthorProfiles({});
      setCommentAuthorProfilesByCommentId({});
      return;
    }

    const nextCommentAuthorProfiles: Record<number, UserProfile> = {};

    if (typeof activeProfile?.profileId === "number") {
      nextCommentAuthorProfiles[activeProfile.profileId] = activeProfile;
    }

    if (typeof visibleCurrentUser?.profileId === "number") {
      nextCommentAuthorProfiles[visibleCurrentUser.profileId] = visibleCurrentUser;
    }

    const commentAuthorProfileIds = [...new Set(
      comments
        .map((comment) => comment.authorProfileId)
        .filter(
          (authorProfileId): authorProfileId is number =>
            typeof authorProfileId === "number" && authorProfileId > 0
        )
    )];

    commentAuthorProfileIds.forEach((authorProfileId) => {
      if (nextCommentAuthorProfiles[authorProfileId]) {
        return;
      }

      const cachedAuthorProfile = readCachedProfileSnapshot<UserProfile>(authorProfileId);

      if (cachedAuthorProfile && typeof cachedAuthorProfile.profileId === "number") {
        nextCommentAuthorProfiles[authorProfileId] = cachedAuthorProfile;
      }
    });

    const pendingCommentAuthorProfileIds = commentAuthorProfileIds.filter(
      (authorProfileId) => !nextCommentAuthorProfiles[authorProfileId]
    );

    if (!pendingCommentAuthorProfileIds.length) {
      setCommentAuthorProfiles(nextCommentAuthorProfiles);
      return;
    }

    let isCancelled = false;

    void Promise.all(
      pendingCommentAuthorProfileIds.map(async (authorProfileId) => {
        try {
          const nextAuthorProfile = await bridge.getProfileById(authorProfileId);

          return nextAuthorProfile && typeof nextAuthorProfile.profileId === "number"
            ? nextAuthorProfile
            : null;
        } catch (error) {
          return null;
        }
      })
    ).then((resolvedCommentAuthorProfiles) => {
      if (isCancelled) {
        return;
      }

      const resolvedCommentAuthorProfileMap = { ...nextCommentAuthorProfiles };

      resolvedCommentAuthorProfiles.forEach((resolvedCommentAuthorProfile) => {
        if (!resolvedCommentAuthorProfile || typeof resolvedCommentAuthorProfile.profileId !== "number") {
          return;
        }

        writeCachedProfileSnapshot(resolvedCommentAuthorProfile);
        resolvedCommentAuthorProfileMap[resolvedCommentAuthorProfile.profileId] =
          resolvedCommentAuthorProfile;
      });

      setCommentAuthorProfiles(resolvedCommentAuthorProfileMap);
    });

    return () => {
      isCancelled = true;
    };
  }, [comments, activeProfile, visibleCurrentUser]);

  useEffect(() => {
    if (!comments.length) {
      setCommentAuthorProfilesByCommentId({});
      return;
    }

    const bridge = getWindowState().sakuraFirebaseAuth;

    if (!bridge) {
      setCommentAuthorProfilesByCommentId({});
      return;
    }

    let isCancelled = false;

    void (async () => {
      const nextCommentAuthorProfilesByCommentId: Record<string, UserProfile> = {};

      comments.forEach((comment) => {
        if (activeProfile && commentMatchesUser(comment, activeProfile)) {
          nextCommentAuthorProfilesByCommentId[comment.id] = activeProfile;
          return;
        }

        if (visibleCurrentUser && commentMatchesUser(comment, visibleCurrentUser)) {
          nextCommentAuthorProfilesByCommentId[comment.id] = visibleCurrentUser;
          return;
        }

        if (typeof comment.authorProfileId === "number" && commentAuthorProfiles[comment.authorProfileId]) {
          nextCommentAuthorProfilesByCommentId[comment.id] = commentAuthorProfiles[comment.authorProfileId];
        }
      });

      const unresolvedComments = comments.filter(
        (comment) =>
          !nextCommentAuthorProfilesByCommentId[comment.id] &&
          normalizeCommentAuthorKey(comment.authorName)
      );

      if (unresolvedComments.length) {
        const profilesByAuthorKey = new Map<string, UserProfile>();
        const unresolvedAuthorNames = [...new Set(
          unresolvedComments.map((comment) => normalizeCommentAuthorKey(comment.authorName)).filter(Boolean)
        )];

        await Promise.all(
          unresolvedAuthorNames.map(async (unresolvedAuthorName) => {
            const sampleComment = unresolvedComments.find(
              (comment) => normalizeCommentAuthorKey(comment.authorName) === unresolvedAuthorName
            );

            if (!sampleComment) {
              return;
            }

            try {
              const resolvedCommentAuthorProfile = await bridge.getProfileByAuthorName(sampleComment.authorName);

              if (resolvedCommentAuthorProfile) {
                if (typeof resolvedCommentAuthorProfile.profileId === "number") {
                  writeCachedProfileSnapshot(resolvedCommentAuthorProfile);
                }
                profilesByAuthorKey.set(unresolvedAuthorName, resolvedCommentAuthorProfile);
              }
            } catch (error) {
            }
          })
        );

        unresolvedComments.forEach((comment) => {
          const authorKey = normalizeCommentAuthorKey(comment.authorName);

          if (!authorKey) {
            return;
          }

          const resolvedCommentAuthorProfile = profilesByAuthorKey.get(authorKey);

          if (resolvedCommentAuthorProfile) {
            nextCommentAuthorProfilesByCommentId[comment.id] = resolvedCommentAuthorProfile;
          }
        });
      }

      if (isCancelled) {
        return;
      }

      setCommentAuthorProfilesByCommentId(nextCommentAuthorProfilesByCommentId);
    })();

    return () => {
      isCancelled = true;
    };
  }, [comments, commentAuthorProfiles, activeProfile, visibleCurrentUser]);

  useEffect(() => {
    if (!comments.length) {
      setCommentMentionProfilesByKey({});
      return;
    }

    const bridge = getWindowState().sakuraFirebaseAuth;

    if (!bridge) {
      setCommentMentionProfilesByKey({});
      return;
    }

    let isCancelled = false;

    void (async () => {
      const nextMentionProfilesByKey: Record<string, UserProfile> = {};

      const knownProfiles = [activeProfile, visibleCurrentUser, ...Object.values(commentAuthorProfiles)].filter(
        (profile): profile is UserProfile => Boolean(profile)
      );

      knownProfiles.forEach((knownProfile) => {
        const knownLoginKey = normalizeCommentAuthorKey(knownProfile.login);

        if (knownLoginKey) {
          nextMentionProfilesByKey[knownLoginKey] = knownProfile;
        }
      });

      const mentionKeys = [...new Set(comments.flatMap((comment) => extractCommentMentionKeys(comment.message)))];
      const unresolvedMentionKeys = mentionKeys.filter((mentionKey) => !nextMentionProfilesByKey[mentionKey]);

      if (unresolvedMentionKeys.length) {
        await Promise.all(
          unresolvedMentionKeys.map(async (mentionKey) => {
            try {
              const resolvedMentionProfile = await bridge.getProfileByAuthorName(`@${mentionKey}`);

              if (resolvedMentionProfile) {
                nextMentionProfilesByKey[mentionKey] = resolvedMentionProfile;
              }
            } catch (error) {
            }
          })
        );
      }

      if (!isCancelled) {
        setCommentMentionProfilesByKey(nextMentionProfilesByKey);
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [comments, activeProfile, visibleCurrentUser, commentAuthorProfiles]);

  useEffect(() => {
    const activeMentionDraft = getActiveMentionDraft();

    if (!activeMentionComposer || !activeMentionDraft) {
      clearMentionSuggestions();
      return;
    }

    const bridge = getWindowState().sakuraFirebaseAuth;

    if (!bridge) {
      clearMentionSuggestions();
      return;
    }

    let isCancelled = false;
    const cachedSuggestions = mentionSuggestionsCacheRef.current[activeMentionDraft.query];

    if (cachedSuggestions) {
      setIsMentionSuggestionsLoading(false);
      setMentionSuggestions(cachedSuggestions);
      return;
    }

    setIsMentionSuggestionsLoading(true);
    setMentionSuggestions([]);
    const searchTimeout = window.setTimeout(() => {
      bridge
        .getProfilesByLoginPrefix(activeMentionDraft.query)
        .then((profiles) => {
          if (isCancelled) {
            return;
          }

          const normalizedProfiles = profiles.filter((profile, index, entries) =>
            Boolean(profile.login) &&
            index === entries.findIndex((entry) => entry.uid === profile.uid)
          );

          mentionSuggestionsCacheRef.current[activeMentionDraft.query] = normalizedProfiles;
          setMentionSuggestions(normalizedProfiles);
        })
        .catch(() => {
          if (!isCancelled) {
            setMentionSuggestions([]);
          }
        })
        .finally(() => {
          if (!isCancelled) {
            setIsMentionSuggestionsLoading(false);
          }
        });
    }, 120);

    return () => {
      isCancelled = true;
      window.clearTimeout(searchTimeout);
    };
  }, [
    activeMentionComposer,
    commentInput,
    commentMentionCaret,
    editingCommentMessage,
    editingCommentMentionCaret,
  ]);

  useEffect(() => {
    const bridge = getWindowState().sakuraFirebaseAuth;
    const syncMentionProfiles = async (
      value: string,
      setProfilesByKey: (value: Record<string, UserProfile>) => void
    ) => {
      const mentionKeys = extractCommentMentionKeys(value);

      if (!mentionKeys.length || !bridge) {
        setProfilesByKey({});
        return;
      }

      const nextProfilesByKey: Record<string, UserProfile> = {};
      const knownProfiles = [
        activeProfile,
        visibleCurrentUser,
        ...Object.values(commentAuthorProfiles),
        ...Object.values(commentMentionProfilesByKey),
      ].filter((profile): profile is UserProfile => Boolean(profile));

      knownProfiles.forEach((profile) => {
        const loginKey = normalizeCommentAuthorKey(profile.login);

        if (loginKey) {
          nextProfilesByKey[loginKey] = profile;
        }
      });

      const unresolvedMentionKeys = mentionKeys.filter((mentionKey) => !nextProfilesByKey[mentionKey]);

      if (unresolvedMentionKeys.length) {
        await Promise.all(
          unresolvedMentionKeys.map(async (mentionKey) => {
            try {
              const resolvedProfile = await bridge.getProfileByAuthorName(`@${mentionKey}`);

              if (resolvedProfile) {
                nextProfilesByKey[mentionKey] = resolvedProfile;
              }
            } catch (error) {
            }
          })
        );
      }

      setProfilesByKey(nextProfilesByKey);
    };

    void syncMentionProfiles(commentInput, setCommentDraftMentionProfilesByKey);
    void syncMentionProfiles(editingCommentMessage, setEditingDraftMentionProfilesByKey);
  }, [
    commentInput,
    editingCommentMessage,
    activeProfile,
    visibleCurrentUser,
    commentAuthorProfiles,
    commentMentionProfilesByKey,
  ]);

  useEffect(() => {
    if (!activeMentionComposer) {
      return;
    }

    const idleTimeout = window.setTimeout(() => {
      const activeTextarea =
        activeMentionComposer === "new"
          ? commentTextareaRef.current
          : editingCommentTextareaRef.current;

      activeTextarea?.blur();
      setActiveMentionComposer(null);
      clearMentionSuggestions();
    }, 60 * 1000);

    return () => {
      window.clearTimeout(idleTimeout);
    };
  }, [activeMentionComposer, mentionComposerActivityTick]);

  const normalizedDraftRoles = normalizeRoleSelection(draftRoles);
  const availableRoleOptions = EDITABLE_ROLE_OPTIONS.filter(
    (role) =>
      (actorIsRootManager || normalizeRoleName(role) !== "root") &&
      !normalizedDraftRoles.some(
        (draftRole) => normalizeRoleName(draftRole) === normalizeRoleName(role)
      )
  );
  const hasRoleChanges =
    normalizedDraftRoles.join("|") !== normalizedProfileRoles.join("|");

  const handleMentionComposerChange = (
    mode: MentionComposerMode,
    event: ChangeEvent<HTMLTextAreaElement>
  ) => {
    const nextValue = event.currentTarget.value;

    if (mode === "new") {
      setCommentInput(nextValue);
      setCommentDraftMentionProfilesByKey((currentProfiles) =>
        filterComposerMentionProfilesByValue(nextValue, currentProfiles)
      );
    } else {
      setEditingCommentMessage(nextValue);
      setEditingDraftMentionProfilesByKey((currentProfiles) =>
        filterComposerMentionProfilesByValue(nextValue, currentProfiles)
      );
    }

    updateMentionComposerCaret(mode, event.currentTarget);
  };
  const handleMentionComposerInteraction = (
    mode: MentionComposerMode,
    element: HTMLTextAreaElement
  ) => {
    updateMentionComposerCaret(mode, element);
    setMentionComposerActivityTick(Date.now());
  };
  const handleMentionComposerBlur = () => {
    window.requestAnimationFrame(() => {
      const activeElement = document.activeElement;

      if (
        activeElement !== commentTextareaRef.current &&
        activeElement !== editingCommentTextareaRef.current
      ) {
        setActiveMentionComposer(null);
        clearMentionSuggestions();
      }
    });
  };

  const handleLogout = async () => {
    const bridge = getWindowState().sakuraFirebaseAuth;
    if (!bridge) return;
    setIsLoggingOut(true);
    try {
      await bridge.logout();
      router.push("/");
    } finally {
      setIsLoggingOut(false);
    }
  };

  const toggleHeaderProfileSearch = () => {
    setIsHeaderProfileSearchOpen((isOpen) => {
      const nextIsOpen = !isOpen;

      if (!nextIsOpen) {
        headerProfileSearchRequestIdRef.current += 1;
        setIsHeaderProfileSearchLoading(false);
        setHeaderProfileSearchError(null);
        setHeaderProfileSearchFeedback(null);
      }

      return nextIsOpen;
    });
  };
  const closeHeaderProfileSearch = () => {
    headerProfileSearchRequestIdRef.current += 1;
    setIsHeaderProfileSearchOpen(false);
    setIsHeaderProfileSearchLoading(false);
    setHeaderProfileSearchError(null);
    setHeaderProfileSearchFeedback(null);
  };

  const runHeaderProfileSearch = useCallback(async (inputQuery: string) => {
    const bridge = getWindowState().sakuraFirebaseAuth;
    const rawQuery = inputQuery.trim();
    const normalizedLookup = rawQuery.replace(/^@+/, "");
    const isUidLookup = /^\d+$/.test(normalizedLookup);
    const shouldSearchByText = normalizedLookup.length >= 2;
    const shouldRunSearch = isUidLookup || shouldSearchByText;
    const requestId = ++headerProfileSearchRequestIdRef.current;

    setHeaderProfileSearchError(null);

    if (!rawQuery) {
      setHeaderProfileSearchResults([]);
      setHeaderProfileSearchFeedback(null);
      setIsHeaderProfileSearchLoading(false);
      return;
    }

    if (!shouldRunSearch) {
      setHeaderProfileSearchResults([]);
      setHeaderProfileSearchFeedback("Type at least 2 characters to search.");
      setIsHeaderProfileSearchLoading(false);
      return;
    }

    if (!bridge) {
      setHeaderProfileSearchResults([]);
      setHeaderProfileSearchError("Profile search is unavailable right now.");
      setHeaderProfileSearchFeedback(null);
      setIsHeaderProfileSearchLoading(false);
      return;
    }

    setIsHeaderProfileSearchLoading(true);
    setHeaderProfileSearchFeedback("Searching...");

    try {
      const resultsByKey = new Map<string, UserProfile>();
      const includeProfile = (profile: UserProfile | null) => {
        if (!profile) {
          return;
        }

        const identityKey = profileSearchIdentityKey(profile);

        if (!identityKey || resultsByKey.has(identityKey)) {
          return;
        }

        resultsByKey.set(identityKey, profile);
      };

      if (isUidLookup) {
        const profileId = Number(normalizedLookup);

        if (Number.isInteger(profileId) && profileId > 0) {
          includeProfile(await bridge.getProfileById(profileId));
        }
      }

      const authorQueries = Array.from(
        new Set([rawQuery, normalizedLookup].filter((value) => value.length > 0))
      );
      const authorMatches = await Promise.all(
        authorQueries.map((authorQuery) => bridge.getProfileByAuthorName(authorQuery))
      );
      authorMatches.forEach((profile) => includeProfile(profile));

      if (normalizedLookup.length >= 2) {
        const prefixMatches = await bridge.getProfilesByLoginPrefix(normalizedLookup);
        prefixMatches.forEach((profile) => includeProfile(profile));
      }

      const resolvedResults = Array.from(resultsByKey.values()).slice(0, 8);
      if (requestId !== headerProfileSearchRequestIdRef.current) {
        return;
      }

      setHeaderProfileSearchResults(resolvedResults);

      if (resolvedResults.length) {
        setHeaderProfileSearchFeedback(
          `Found ${resolvedResults.length} account${resolvedResults.length === 1 ? "" : "s"}.`
        );
      } else {
        setHeaderProfileSearchFeedback(`No accounts found for "${rawQuery}".`);
      }
    } catch (error) {
      if (requestId !== headerProfileSearchRequestIdRef.current) {
        return;
      }

      setHeaderProfileSearchResults([]);
      setHeaderProfileSearchFeedback(null);
      setHeaderProfileSearchError(getProfileActionErrorMessage(error, "Could not search accounts."));
    } finally {
      if (requestId === headerProfileSearchRequestIdRef.current) {
        setIsHeaderProfileSearchLoading(false);
      }
    }
  }, []);

  const handleHeaderProfileSearchSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await runHeaderProfileSearch(headerProfileSearchQuery);
  };

  useEffect(() => {
    if (!isHeaderProfileSearchOpen) {
      return;
    }

    const trimmedQuery = headerProfileSearchQuery.trim();
    if (!trimmedQuery) {
      headerProfileSearchRequestIdRef.current += 1;
      setHeaderProfileSearchResults([]);
      setHeaderProfileSearchError(null);
      setHeaderProfileSearchFeedback(null);
      setIsHeaderProfileSearchLoading(false);
      return;
    }

    const searchDelayMs = 180;
    const timeoutId = window.setTimeout(() => {
      void runHeaderProfileSearch(headerProfileSearchQuery);
    }, searchDelayMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [headerProfileSearchQuery, isHeaderProfileSearchOpen, runHeaderProfileSearch]);

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    const bridge = getWindowState().sakuraFirebaseAuth;
    if (!file || !bridge) return;
    if (PREMIUM_AVATAR_MEDIA_TYPES.has(file.type) && !canUseEnhancedAvatarMedia) {
      setAvatarError(USER_AVATAR_UPGRADE_MESSAGE);
      setAvatarSuccess(null);
      return;
    }
    if (!isSupabaseConfigured) {
      setAvatarError(getSupabaseAvatarUnavailableMessage());
      return;
    }
    setAvatarError(null);
    setAvatarSuccess(null);
    setIsAvatarUploading(true);

    let uploadedAvatar: SupabaseCommentMediaUploadResult | null = null;

    try {
      let snapshot: UserProfile | null = null;
      const targetUid =
        isOwner ? visibleCurrentUser?.uid ?? activeProfile?.uid : activeProfile?.uid;

      if (!targetUid) {
        throw new Error("Could not resolve the target account for avatar upload.");
      }

      uploadedAvatar = await uploadSupabaseAvatarMedia(file, targetUid);
      const avatarPayload = toAvatarUploadPayload(uploadedAvatar);

      if (isOwner) {
        snapshot = await withAvatarActionTimeout(bridge.updateAvatar(avatarPayload));
      } else if (canOpenAdminPanel && activeProfile?.profileId) {
        snapshot = await withAvatarActionTimeout(
          bridge.adminUpdateProfileAvatar(activeProfile.profileId, avatarPayload)
        );
      }

      if (activeProfile?.avatarPath && activeProfile.avatarPath !== uploadedAvatar.path) {
        void deleteSupabaseStorageObject(activeProfile.avatarPath).catch((cleanupError) => {
          console.error("Failed to remove replaced avatar media:", cleanupError);
        });
      }

      applyUpdatedProfileSnapshot(snapshot);
      setAvatarSuccess(isOwner ? "Avatar saved." : "Avatar updated.");
    } catch (error) {
      if (uploadedAvatar && shouldCleanupUploadedMedia(uploadedAvatar)) {
        void deleteSupabaseStorageObject(uploadedAvatar.path).catch((cleanupError) => {
          console.error("Failed to cleanup uploaded avatar media:", cleanupError);
        });
      }

      setAvatarError(avatarErrorMessage(error));
    } finally {
      setIsAvatarUploading(false);
    }
  };

  const handleAvatarDelete = async () => {
    const bridge = getWindowState().sakuraFirebaseAuth;
    if (!bridge) return;
    setAvatarError(null);
    setAvatarSuccess(null);
    setIsAvatarDeleting(true);
    try {
      let snapshot: UserProfile | null = null;

      if (isOwner) {
        snapshot = await withAvatarActionTimeout(bridge.deleteAvatar());
      } else if (canOpenAdminPanel && activeProfile?.profileId) {
        snapshot = await withAvatarActionTimeout(
          bridge.adminDeleteProfileAvatar(activeProfile.profileId)
        );
      }

      applyUpdatedProfileSnapshot(snapshot);
      setAvatarSuccess("Avatar deleted.");

      if (activeProfile?.avatarPath) {
        void deleteSupabaseStorageObject(activeProfile.avatarPath).catch((cleanupError) => {
          console.error("Failed to remove deleted avatar media:", cleanupError);
        });
      }
    } catch (error) {
      setAvatarError(avatarErrorMessage(error));
    } finally {
      setIsAvatarDeleting(false);
    }
  };

  const handleBannerChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    const bridge = getWindowState().sakuraFirebaseAuth;
    if (!file || !bridge || !bridge.updateBanner) return;
    if (!isSupabaseConfigured) {
      setBannerError(getSupabaseAvatarUnavailableMessage());
      return;
    }
    setBannerError(null);
    setBannerSuccess(null);
    setIsBannerUploading(true);

    let uploadedBanner: SupabaseCommentMediaUploadResult | null = null;

    try {
      let snapshot: UserProfile | null = null;
      const targetUid =
        isOwner ? visibleCurrentUser?.uid ?? activeProfile?.uid : activeProfile?.uid;

      if (!targetUid) {
        throw new Error("Could not resolve target account for banner upload.");
      }

      uploadedBanner = await uploadSupabaseAvatarMedia(file, targetUid);
      const bannerPayload = toAvatarUploadPayload(uploadedBanner);

      if (isOwner && bridge.updateBanner) {
        snapshot = await withAvatarActionTimeout(bridge.updateBanner(bannerPayload));
      } else if (canOpenAdminPanel && activeProfile?.profileId && bridge.adminUpdateProfileBanner) {
        snapshot = await withAvatarActionTimeout(
          bridge.adminUpdateProfileBanner(activeProfile.profileId, bannerPayload)
        );
      }

      if (activeProfile?.bannerPath && activeProfile.bannerPath !== uploadedBanner.path) {
        void deleteSupabaseStorageObject(activeProfile.bannerPath).catch((cleanupError) => {
          console.error("Failed to remove replaced banner media:", cleanupError);
        });
      }

      applyUpdatedProfileSnapshot(snapshot);
      setBannerSuccess(t("Banner saved.", "Баннер сохранён."));
    } catch (error) {
      if (uploadedBanner && shouldCleanupUploadedMedia(uploadedBanner)) {
        void deleteSupabaseStorageObject(uploadedBanner.path).catch((cleanupError) => {
          console.error("Failed to cleanup uploaded banner media:", cleanupError);
        });
      }

      setBannerError(avatarErrorMessage(error));
    } finally {
      setIsBannerUploading(false);
    }
  };

  const handleBannerDelete = async () => {
    const bridge = getWindowState().sakuraFirebaseAuth;
    if (!bridge || !bridge.deleteBanner) return;
    setBannerError(null);
    setBannerSuccess(null);
    setIsBannerDeleting(true);
    try {
      let snapshot: UserProfile | null = null;

      if (isOwner && bridge.deleteBanner) {
        snapshot = await withAvatarActionTimeout(bridge.deleteBanner());
      } else if (canOpenAdminPanel && activeProfile?.profileId && bridge.adminDeleteProfileBanner) {
        snapshot = await withAvatarActionTimeout(
          bridge.adminDeleteProfileBanner(activeProfile.profileId)
        );
      }

      applyUpdatedProfileSnapshot(snapshot);
      setBannerSuccess(t("Banner removed.", "Баннер удалён."));

      if (activeProfile?.bannerPath) {
        void deleteSupabaseStorageObject(activeProfile.bannerPath).catch((cleanupError) => {
          console.error("Failed to remove deleted banner media:", cleanupError);
        });
      }
    } catch (error) {
      setBannerError(avatarErrorMessage(error));
    } finally {
      setIsBannerDeleting(false);
    }
  };

  const addRole = (role: string) => {
    setRolesError(null);
    setRolesSuccess(null);
    setDraftRoles((currentRoles) => normalizeRoleSelection([...currentRoles, role]));
  };

  const removeRole = (role: string) => {
    setRolesError(null);
    setRolesSuccess(null);
    setDraftRoles((currentRoles) => {
      const normalizedTarget = normalizeRoleName(role);
      const nextRoles = currentRoles.filter(
        (currentRole) => normalizeRoleName(currentRole) !== normalizedTarget
      );

      return nextRoles.length ? normalizeRoleSelection(nextRoles) : ["user"];
    });
  };

  const resetRoles = () => {
    setDraftRoles(normalizedProfileRoles);
    setRolesError(null);
    setRolesSuccess(null);
  };

  const handleRolesSave = async () => {
    const bridge = getWindowState().sakuraFirebaseAuth;

    if (!bridge || !activeProfile?.profileId || !canManageRoleAssignments) {
      return;
    }

    const shouldSetLifetimeSubscriptionUntil = normalizedDraftRoles.some(
      (role) => normalizeRoleName(role) === "lifetime"
    );
    const lifetimeSubscriptionUntil = parseDateTimeLocalInputValue(
      LIFETIME_SUBSCRIPTION_UNTIL_INPUT_VALUE
    );

    setRolesError(null);
    setRolesSuccess(null);
    setIsRolesSaving(true);

    try {
      let nextSnapshot = await bridge.updateProfileRoles(
        activeProfile.profileId,
        normalizedDraftRoles
      );

      if (
        shouldSetLifetimeSubscriptionUntil &&
        lifetimeSubscriptionUntil &&
        typeof bridge.adminUpdateProfileSubscriptionUntil === "function"
      ) {
        const subscriptionSnapshot = await bridge.adminUpdateProfileSubscriptionUntil(
          activeProfile.profileId,
          lifetimeSubscriptionUntil
        );

        if (subscriptionSnapshot) {
          nextSnapshot = subscriptionSnapshot;
        }

        setAdminSubscriptionUntilInput(LIFETIME_SUBSCRIPTION_UNTIL_INPUT_VALUE);
        setAdminSubscriptionUntilError(null);
        setAdminSubscriptionUntilSuccess(null);
      }

      if (nextSnapshot) {
        setProfile(nextSnapshot);
        if (visibleCurrentUser?.uid === nextSnapshot.uid) {
          setCurrentUser(nextSnapshot);
        }
      }

      setRolesSuccess("Roles updated.");
    } catch (error) {
      setRolesError(error instanceof Error ? error.message : "Could not update roles.");
    } finally {
      setIsRolesSaving(false);
    }
  };

  const handleAdminGrantActiveSubscription = async () => {
    const bridge = getWindowState().sakuraFirebaseAuth;

    if (!bridge || !activeProfile?.profileId || !canManageRoleAssignments) {
      return;
    }

    setAdminSubscriptionError(null);
    setAdminSubscriptionSuccess(null);
    setIsAdminSubscriptionSaving(true);

    try {
      const nextRoles = normalizeRoleSelection([
        ...(activeProfile.roles ?? []).filter(
          (role) => normalizeRoleName(role) !== "test period"
        ),
        "subscriber",
      ]);
      const snapshot = await bridge.updateProfileRoles(activeProfile.profileId, nextRoles);

      if (snapshot) {
        applyUpdatedProfileSnapshot(snapshot);
        setProfile(snapshot);
        if (visibleCurrentUser?.uid === snapshot.uid) {
          setCurrentUser(snapshot);
        }
        setDraftRoles(normalizeRoleSelection(snapshot.roles));
      } else {
        setDraftRoles(nextRoles);
      }

      setAdminSubscriptionSuccess(
        t("Active subscription granted.", "Активная подписка выдана.")
      );
    } catch (error) {
      setAdminSubscriptionError(
        error instanceof Error ? error.message : "Could not grant active subscription."
      );
    } finally {
      setIsAdminSubscriptionSaving(false);
    }
  };

  const handleAdminGrantLifetimeSubscription = async () => {
    const bridge = getWindowState().sakuraFirebaseAuth;

    if (!bridge || !activeProfile?.profileId || !canManageRoleAssignments) {
      return;
    }

    const lifetimeSubscriptionUntil = parseDateTimeLocalInputValue(
      LIFETIME_SUBSCRIPTION_UNTIL_INPUT_VALUE
    );

    setAdminSubscriptionError(null);
    setAdminSubscriptionSuccess(null);
    setAdminSubscriptionUntilError(null);
    setAdminSubscriptionUntilSuccess(null);
    setIsAdminSubscriptionSaving(true);

    try {
      const nextRoles = normalizeRoleSelection([
        ...(activeProfile.roles ?? []).filter((role) => {
          const normalizedRole = normalizeRoleName(role);
          return normalizedRole !== "test period" && normalizedRole !== "subscriber";
        }),
        "lifetime",
      ]);

      let nextSnapshot = await bridge.updateProfileRoles(activeProfile.profileId, nextRoles);

      if (
        lifetimeSubscriptionUntil &&
        typeof bridge.adminUpdateProfileSubscriptionUntil === "function"
      ) {
        const subscriptionSnapshot = await bridge.adminUpdateProfileSubscriptionUntil(
          activeProfile.profileId,
          lifetimeSubscriptionUntil
        );

        if (subscriptionSnapshot) {
          nextSnapshot = subscriptionSnapshot;
        }
      }

      if (nextSnapshot) {
        applyUpdatedProfileSnapshot(nextSnapshot);
        setProfile(nextSnapshot);
        if (visibleCurrentUser?.uid === nextSnapshot.uid) {
          setCurrentUser(nextSnapshot);
        }
        setDraftRoles(normalizeRoleSelection(nextSnapshot.roles));
      } else {
        setDraftRoles(nextRoles);
      }

      setAdminSubscriptionUntilInput(LIFETIME_SUBSCRIPTION_UNTIL_INPUT_VALUE);
      setAdminSubscriptionSuccess(
        t("Lifetime subscription granted.", "Lifetime subscription granted.")
      );
    } catch (error) {
      setAdminSubscriptionError(
        error instanceof Error ? error.message : "Could not grant lifetime subscription."
      );
    } finally {
      setIsAdminSubscriptionSaving(false);
    }
  };

  const handleAdminRevokeActiveSubscription = async () => {
    const bridge = getWindowState().sakuraFirebaseAuth;

    if (!bridge || !activeProfile?.profileId || !canManageRoleAssignments) {
      return;
    }

    setAdminSubscriptionError(null);
    setAdminSubscriptionSuccess(null);
    setIsAdminSubscriptionSaving(true);

    try {
      const nextRoles = normalizeRoleSelection(
        (activeProfile.roles ?? []).filter(
          (role) => normalizeRoleName(role) !== "subscriber"
        )
      );
      const snapshot = await bridge.updateProfileRoles(activeProfile.profileId, nextRoles);

      if (snapshot) {
        applyUpdatedProfileSnapshot(snapshot);
        setProfile(snapshot);
        if (visibleCurrentUser?.uid === snapshot.uid) {
          setCurrentUser(snapshot);
        }
        setDraftRoles(normalizeRoleSelection(snapshot.roles));
      } else {
        setDraftRoles(nextRoles);
      }

      setAdminSubscriptionSuccess(
        t("Active subscription revoked.", "Active subscription revoked.")
      );
    } catch (error) {
      setAdminSubscriptionError(
        error instanceof Error ? error.message : "Could not revoke active subscription."
      );
    } finally {
      setIsAdminSubscriptionSaving(false);
    }
  };

  const handleAdminRevokeLifetimeSubscription = async () => {
    const bridge = getWindowState().sakuraFirebaseAuth;

    if (!bridge || !activeProfile?.profileId || !canManageRoleAssignments) {
      return;
    }

    setAdminSubscriptionError(null);
    setAdminSubscriptionSuccess(null);
    setIsAdminSubscriptionSaving(true);

    try {
      const nextRoles = normalizeRoleSelection(
        (activeProfile.roles ?? []).filter(
          (role) => normalizeRoleName(role) !== "lifetime"
        )
      );
      const snapshot = await bridge.updateProfileRoles(activeProfile.profileId, nextRoles);

      if (snapshot) {
        applyUpdatedProfileSnapshot(snapshot);
        setProfile(snapshot);
        if (visibleCurrentUser?.uid === snapshot.uid) {
          setCurrentUser(snapshot);
        }
        setDraftRoles(normalizeRoleSelection(snapshot.roles));
      } else {
        setDraftRoles(nextRoles);
      }

      setAdminSubscriptionSuccess(
        t("Lifetime subscription revoked.", "Lifetime subscription revoked.")
      );
    } catch (error) {
      setAdminSubscriptionError(
        error instanceof Error ? error.message : "Could not revoke lifetime subscription."
      );
    } finally {
      setIsAdminSubscriptionSaving(false);
    }
  };

  type SubscriptionUntilOffset = {
    days?: number;
    months?: number;
    years?: number;
  };

  const applyAdminSubscriptionUntilOffset = (offset: SubscriptionUntilOffset) => {
    if (hasLifetimeRole) {
      return;
    }

    const parsedInputSubscriptionUntil = parseDateTimeLocalInputValue(adminSubscriptionUntilInput);
    const parsedProfileSubscriptionUntil = resolveProfileSubscriptionUntil(activeProfile);
    const now = new Date();

    const baseDate = parsedInputSubscriptionUntil
      ? new Date(parsedInputSubscriptionUntil)
      : parsedProfileSubscriptionUntil
        ? new Date(parsedProfileSubscriptionUntil)
        : now;

    if (Number.isNaN(baseDate.getTime())) {
      setAdminSubscriptionUntilError("Could not resolve subscription end date.");
      setAdminSubscriptionUntilSuccess(null);
      return;
    }

    const nextDate = new Date(baseDate.getTime() < now.getTime() ? now : baseDate);

    if (typeof offset.days === "number" && Number.isFinite(offset.days) && offset.days !== 0) {
      nextDate.setDate(nextDate.getDate() + offset.days);
    }

    if (typeof offset.months === "number" && Number.isFinite(offset.months) && offset.months !== 0) {
      nextDate.setMonth(nextDate.getMonth() + offset.months);
    }

    if (typeof offset.years === "number" && Number.isFinite(offset.years) && offset.years !== 0) {
      nextDate.setFullYear(nextDate.getFullYear() + offset.years);
    }

    setAdminSubscriptionUntilInput(toDateTimeLocalInputValue(nextDate.toISOString()));
    setAdminSubscriptionUntilError(null);
    setAdminSubscriptionUntilSuccess(null);
  };

  const handleAdminSubscriptionUntilSave = async () => {
    const bridge = getWindowState().sakuraFirebaseAuth;

    if (!bridge || !activeProfile?.profileId || !canManageRoleAssignments) {
      return;
    }

    if (typeof bridge.adminUpdateProfileSubscriptionUntil !== "function") {
      setAdminSubscriptionUntilError("Subscription end date update is unavailable in the current runtime.");
      setAdminSubscriptionUntilSuccess(null);
      return;
    }

    const nextSubscriptionUntil = parseDateTimeLocalInputValue(adminSubscriptionUntilInput);

    if (adminSubscriptionUntilInput.trim() && !nextSubscriptionUntil) {
      setAdminSubscriptionUntilError("Enter a valid subscription end date.");
      setAdminSubscriptionUntilSuccess(null);
      return;
    }

    setAdminSubscriptionUntilError(null);
    setAdminSubscriptionUntilSuccess(null);
    setIsAdminSubscriptionUntilSaving(true);

    try {
      const snapshot = await bridge.adminUpdateProfileSubscriptionUntil(
        activeProfile.profileId,
        nextSubscriptionUntil
      );

      applyUpdatedProfileSnapshot(snapshot);
      setAdminSubscriptionUntilInput(toDateTimeLocalInputValue(nextSubscriptionUntil));
      setAdminSubscriptionUntilSuccess(
        nextSubscriptionUntil
          ? t("Subscription end date saved.", "Subscription end date saved.")
          : t("Subscription end date cleared.", "Subscription end date cleared.")
      );
    } catch (error) {
      setAdminSubscriptionUntilError(
        error instanceof Error ? error.message : "Could not update subscription end date."
      );
    } finally {
      setIsAdminSubscriptionUntilSaving(false);
    }
  };

  const handleAdminResetHwid = async () => {
    const bridge = getWindowState().sakuraFirebaseAuth;

    if (!bridge || !activeProfile?.profileId || !canManageRoleAssignments) {
      return;
    }

    if (typeof bridge.adminResetProfileHwid !== "function") {
      setAdminHwidError("HWID reset is unavailable in the current runtime.");
      setAdminHwidSuccess(null);
      return;
    }

    setAdminHwidError(null);
    setAdminHwidSuccess(null);
    setIsAdminHwidResetting(true);

    try {
      const snapshot = await bridge.adminResetProfileHwid(activeProfile.profileId);
      applyUpdatedProfileSnapshot(snapshot);
      setAdminHwidSuccess(t("HWID reset completed.", "HWID reset completed."));
    } catch (error) {
      setAdminHwidError(error instanceof Error ? error.message : "Could not reset HWID.");
    } finally {
      setIsAdminHwidResetting(false);
    }
  };

  const handleRedeemPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    const bridge = getWindowState().sakuraFirebaseAuth;
    if (!bridge?.redeemPromoCode || !promoCodeInput.trim()) return;
    setIsRedeemingPromo(true);
    setPromoErrorMessage(null);
    setPromoSuccessMessage(null);
    try {
      const res = await bridge.redeemPromoCode(promoCodeInput.trim());
      if (res?.isLifetime) {
        setPromoSuccessMessage(t("Lifetime access activated!", "Бессрочный доступ (Lifetime) успешно активирован!"));
      } else {
        setPromoSuccessMessage(
          t(`Promo code activated! +${res.durationDays} days added.`, `Промокод активирован! Добавлено +${res.durationDays} дн.`)
        );
      }
      setPromoCodeInput("");
    } catch (err: any) {
      setPromoErrorMessage(err?.message || t("Failed to redeem promo code.", "Не удалось активировать промокод."));
    } finally {
      setIsRedeemingPromo(false);
    }
  };

  const hasAlreadyClaimedTrial = Boolean(
    activeProfile?.hasClaimedTrial === true ||
    activeProfile?.activationHistory?.some(
      (item) => item.type === "trial" || item.code === "7-DAYS-TRIAL"
    )
  );

  const [isClaimingTrial, setIsClaimingTrial] = useState(false);
  const [trialClaimSuccess, setTrialClaimSuccess] = useState<string | null>(null);
  const [trialClaimError, setTrialClaimError] = useState<string | null>(null);

  const handleClaimTrial = async () => {
    const bridge = getWindowState().sakuraFirebaseAuth;
    if (!bridge?.claimFreeTrial) return;
    setIsClaimingTrial(true);
    setTrialClaimError(null);
    setTrialClaimSuccess(null);
    try {
      await bridge.claimFreeTrial();
      setTrialClaimSuccess(t("7 days of free trial activated!", "7 дней бесплатного теста успешно активировано!"));
      window.location.reload();
    } catch (err: any) {
      setTrialClaimError(err?.message || t("Failed to activate trial.", "Не удалось активировать тест."));
    } finally {
      setIsClaimingTrial(false);
    }
  };

  const handleFreezeSubscription = async () => {
    const bridge = getWindowState().sakuraFirebaseAuth;
    if (!bridge?.freezeSubscription) return;
    if (!window.confirm(t("Freeze subscription? While frozen, you cannot launch Sakura until you unfreeze it.", "Заморозить подписку? Пока подписка заморожена, вход в Sakura будет заблокирован до разморозки."))) return;
    setIsFreezingSubscription(true);
    setFreezeErrorMessage(null);
    setFreezeSuccessMessage(null);
    try {
      const snapshot = await bridge.freezeSubscription();
      applyUpdatedProfileSnapshot(snapshot);
      setFreezeSuccessMessage(t("Subscription frozen. Remaining time paused.", "Подписка заморожена. Таймер времени приостановлен."));
    } catch (err: any) {
      setFreezeErrorMessage(err?.message || t("Failed to freeze subscription.", "Не удалось заморозить подписку."));
    } finally {
      setIsFreezingSubscription(false);
    }
  };

  const handleUnfreezeSubscription = async () => {
    const bridge = getWindowState().sakuraFirebaseAuth;
    if (!bridge?.unfreezeSubscription) return;
    setIsFreezingSubscription(true);
    setFreezeErrorMessage(null);
    setFreezeSuccessMessage(null);
    try {
      const snapshot = await bridge.unfreezeSubscription();
      applyUpdatedProfileSnapshot(snapshot);
      setFreezeSuccessMessage(t("Subscription unfrozen! Sakura access restored.", "Подписка разморожена! Доступ к Sakura восстановлен."));
    } catch (err: any) {
      setFreezeErrorMessage(err?.message || t("Failed to unfreeze subscription.", "Не удалось разморозить подписку."));
    } finally {
      setIsFreezingSubscription(false);
    }
  };

  const handleAdminToggleFreeze = async () => {
    const bridge = getWindowState().sakuraFirebaseAuth;
    if (!bridge?.adminToggleUserFreeze || !activeProfile?.profileId) return;
    setIsAdminFreezeTargetSaving(true);
    try {
      const snapshot = await bridge.adminToggleUserFreeze(activeProfile.profileId);
      applyUpdatedProfileSnapshot(snapshot);
    } catch (err: any) {
      alert(err?.message || "Failed to toggle freeze");
    } finally {
      setIsAdminFreezeTargetSaving(false);
    }
  };

  const loadAdminPromoCodes = async () => {
    const bridge = getWindowState().sakuraFirebaseAuth;
    if (!bridge?.adminListPromoCodes) return;
    setIsAdminPromoLoading(true);
    try {
      const list = await bridge.adminListPromoCodes();
      setAdminPromoList(list || []);
    } catch (err: any) {
      setAdminPromoError(err?.message || "Failed to load promo codes");
    } finally {
      setIsAdminPromoLoading(false);
    }
  };

  const handleAdminCreatePromo = async () => {
    const bridge = getWindowState().sakuraFirebaseAuth;
    if (!bridge?.adminCreatePromoCode) return;
    setIsAdminPromoCreating(true);
    setAdminPromoError(null);
    setAdminPromoSuccess(null);
    try {
      const newPromo = await bridge.adminCreatePromoCode({
        code: adminPromoCodeInput,
        durationDays: adminPromoDaysInput,
        maxUses: adminPromoUsesInput,
        role: adminPromoRoleInput,
        note: adminPromoNoteInput
      });
      setAdminPromoSuccess(t(`Promo code «${newPromo.code}» created!`, `Промокод «${newPromo.code}» успешно создан!`));
      setAdminPromoCodeInput("");
      setAdminPromoNoteInput("");
      await loadAdminPromoCodes();
    } catch (err: any) {
      setAdminPromoError(err?.message || "Failed to create promo code");
    } finally {
      setIsAdminPromoCreating(false);
    }
  };

  const handleAdminDeletePromo = async (code: string) => {
    const bridge = getWindowState().sakuraFirebaseAuth;
    if (!bridge?.adminDeletePromoCode) return;
    if (!window.confirm(t(`Delete promo code «${code}»?`, `Удалить промокод «${code}»?`))) return;
    try {
      await bridge.adminDeletePromoCode(code);
      await loadAdminPromoCodes();
    } catch (err: any) {
      alert(err?.message || "Failed to delete promo code");
    }
  };

  const generateRandomPromoCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let rand = "";
    for (let i = 0; i < 4; i++) rand += chars[Math.floor(Math.random() * chars.length)];
    rand += "-";
    for (let i = 0; i < 4; i++) rand += chars[Math.floor(Math.random() * chars.length)];
    const prefix = adminPromoDaysInput >= 99999 ? "LIFETIME" : `${adminPromoDaysInput}D`;
    setAdminPromoCodeInput(`SAKURA-${prefix}-${rand}`);
  };

  const handleResendVerification = async () => {
    const bridge = getWindowState().sakuraFirebaseAuth;

    if (!bridge || !isOwner) {
      return;
    }

    setVerificationError(null);
    setVerificationSuccess(null);
    setIsVerificationSending(true);

    try {
      const snapshot = await bridge.resendVerificationEmail();

      if (snapshot) {
        setCurrentUser(snapshot);

        if (activeProfile && snapshot.uid === activeProfile.uid) {
          setProfile(snapshot);
        }
      }

      setVerificationSuccess(
        t(
          "Verification email sent. Check Spam/Junk if it is not in Inbox.",
          "Письмо подтверждения отправлено. Проверьте папку Спам, если его нет во входящих."
        )
      );
    } catch (error) {
      setVerificationError(getProfileActionErrorMessage(error, "Could not send verification email."));
    } finally {
      setIsVerificationSending(false);
    }
  };

  const handleDisplayNameSave = async () => {
    const bridge = getWindowState().sakuraFirebaseAuth;
    const nextDisplayName = displayNameInput.trim();

    if (!bridge) {
      return;
    }

    if (!nextDisplayName) {
      setDisplayNameError("Enter a profile name.");
      return;
    }

    if (isOwner) {
      const cooldown = getProfileFieldCooldown(activeProfile?.displayNameUpdatedAt);
      if (cooldown.isLocked && nextDisplayName !== (activeProfile?.displayName || "").trim()) {
        setDisplayNameError(
          t(
            `Display name can be changed only once a month (30 days). Available in ${cooldown.daysLeft} d.`,
            `Отображаемое имя можно изменять только 1 раз в месяц (30 дней). Доступно через ${cooldown.daysLeft} дн.`
          )
        );
        return;
      }
    }

    setDisplayNameError(null);
    setDisplayNameSuccess(null);
    setIsDisplayNameSaving(true);

    try {
      let snapshot: UserProfile | null = null;

      if (isOwner) {
        snapshot = await bridge.updateDisplayName(nextDisplayName);
      } else if (canOpenAdminPanel && activeProfile?.profileId) {
        snapshot = await bridge.adminUpdateProfileDisplayName(activeProfile.profileId, nextDisplayName);
      }

      applyUpdatedProfileSnapshot(snapshot);
      setDisplayNameSuccess(isOwner ? "Profile name saved." : "Profile name updated.");
    } catch (error) {
      setDisplayNameError(error instanceof Error ? error.message : "Could not save profile name.");
    } finally {
      setIsDisplayNameSaving(false);
    }
  };

  const handleUsernameSave = async () => {
    const bridge = getWindowState().sakuraFirebaseAuth;
    const nextUsername = normalizeUsernameDraft(usernameInput);

    if (!bridge) {
      return;
    }

    if (!nextUsername) {
      setUsernameError("Enter a login.");
      return;
    }

    if (isOwner) {
      const cooldown = getProfileFieldCooldown(activeProfile?.loginUpdatedAt);
      if (cooldown.isLocked && nextUsername !== normalizeUsernameDraft(activeProfile?.login)) {
        setUsernameError(
          t(
            `Login can be changed only once a month (30 days). Available in ${cooldown.daysLeft} d.`,
            `Логин можно изменять только 1 раз в месяц (30 дней). Доступно через ${cooldown.daysLeft} дн.`
          )
        );
        return;
      }
    }

    if (isOwner && requiresUsernamePasswordConfirmation && !usernamePasswordInput) {
      setUsernameError("Enter your current password to change the login.");
      return;
    }

    setUsernameError(null);
    setUsernameSuccess(null);
    setIsUsernameSaving(true);

    try {
      let snapshot: UserProfile | null = null;

      if (isOwner) {
        snapshot = await bridge.updateUsername(
          nextUsername,
          requiresUsernamePasswordConfirmation ? usernamePasswordInput : undefined
        );
      } else if (canOpenAdminPanel && activeProfile?.profileId) {
        snapshot = await bridge.adminUpdateProfileLogin(activeProfile.profileId, nextUsername);
      }

      applyUpdatedProfileSnapshot(snapshot);
      if (snapshot?.login) {
        setUsernameInput(snapshot.login);
      }
      if (isOwner) {
        setUsernamePasswordInput("");
      }
      setUsernameSuccess(
        snapshot?.login
          ? (isOwner ? `Login saved: @${snapshot.login}` : `Login updated: @${snapshot.login}`)
          : (isOwner ? "Login saved." : "Login updated.")
      );
    } catch (error) {
      setUsernameError(error instanceof Error ? error.message : "Could not save login.");
    } finally {
      setIsUsernameSaving(false);
    }
  };
  const handlePasswordSave = async () => {
    const bridge = getWindowState().sakuraFirebaseAuth;

    if (!bridge || !isOwner) {
      return;
    }

    if (!currentPasswordInput) {
      setPasswordError("Enter your current password.");
      return;
    }

    if (!newPasswordInput) {
      setPasswordError("Enter a new password.");
      return;
    }

    if (newPasswordInput.length < 6) {
      setPasswordError("New password must contain at least 6 characters.");
      return;
    }

    if (newPasswordInput !== confirmNewPasswordInput) {
      setPasswordError("New passwords do not match.");
      return;
    }

    setPasswordError(null);
    setPasswordSuccess(null);
    setIsPasswordSaving(true);

    try {
      const snapshot = await bridge.updatePassword(currentPasswordInput, newPasswordInput);
      applyUpdatedProfileSnapshot(snapshot);
      setCurrentPasswordInput("");
      setNewPasswordInput("");
      setConfirmNewPasswordInput("");
      setPasswordSuccess("Password updated.");
    } catch (error) {
      setPasswordError(getProfileActionErrorMessage(error, "Could not update password."));
    } finally {
      setIsPasswordSaving(false);
    }
  };
  const handlePasswordResetRequest = async () => {
    const bridge = getWindowState().sakuraFirebaseAuth;
    const resetIdentifier = activeProfile?.email?.trim() ?? "";

    if (!bridge || !isOwner) {
      return;
    }

    if (!resetIdentifier) {
      setPasswordError("No email is linked to this account.");
      return;
    }

    setPasswordError(null);
    setPasswordSuccess(null);
    setIsPasswordResetSending(true);

    try {
      const resetResult = await bridge.sendPasswordReset(resetIdentifier);
      setPasswordSuccess(
        t(
          `Password reset email sent to ${resetResult.email}. Check Spam/Junk if it is not in Inbox.`,
          `Письмо для сброса пароля отправлено на ${resetResult.email}. Проверьте папку Спам, если его нет во входящих.`
        )
      );
    } catch (error) {
      setPasswordError(getProfileActionErrorMessage(error, "Could not send password reset email."));
    } finally {
      setIsPasswordResetSending(false);
    }
  };

  const handleSaveRecoveryPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const bridge = getWindowState().sakuraFirebaseAuth;
    if (!bridge) {
      setRecoveryError(t("Auth service is not ready. Wait a few seconds and try again.", "Сервис авторизации не готов. Подождите пару секунд и попробуйте снова."));
      return;
    }
    if (!recoveryPassword || recoveryPassword.length < 6) {
      setRecoveryError(t("Password must contain at least 6 characters.", "Пароль должен содержать минимум 6 символов."));
      return;
    }
    if (recoveryPassword !== recoveryConfirmPassword) {
      setRecoveryError(t("Passwords do not match.", "Пароли не совпадают."));
      return;
    }

    setRecoverySaving(true);
    setRecoveryError(null);
    try {
      const snap = await bridge.updatePassword("", recoveryPassword);
      try {
        window.sessionStorage.removeItem("sakura_pending_password_reset");
        (window as any).sakuraIsPasswordRecovery = false;
      } catch {}
      setRecoverySuccess(t("Password updated successfully!", "Пароль успешно обновлён!"));
      if (typeof window !== "undefined" && window.history.replaceState) {
        window.history.replaceState(null, "", window.location.pathname);
      }
      if (snap) {
        applyUpdatedProfileSnapshot(snap);
      }
      setTimeout(() => {
        setIsRecoveryModalOpen(false);
      }, 1400);
    } catch (err: any) {
      setRecoveryError(getProfileActionErrorMessage(err, "Could not update password."));
    } finally {
      setRecoverySaving(false);
    }
  };

  const closeRecoveryModal = () => {
    try {
      window.sessionStorage.removeItem("sakura_pending_password_reset");
      (window as any).sakuraIsPasswordRecovery = false;
    } catch {}
    setIsRecoveryModalOpen(false);
  };
  const handleAdminPasswordResetRequest = async () => {
    const bridge = getWindowState().sakuraFirebaseAuth;
    const resetIdentifier = activeProfile?.email?.trim() || activeProfile?.login?.trim() || "";

    if (!bridge || !canOpenAdminPanel || !activeProfile?.profileId) {
      return;
    }

    if (!resetIdentifier) {
      setAdminPasswordResetError("No email or login is available for password reset.");
      setAdminPasswordResetSuccess(null);
      return;
    }

    setAdminPasswordResetError(null);
    setAdminPasswordResetSuccess(null);
    setIsAdminPasswordResetSending(true);

    try {
      const resetResult = await bridge.sendPasswordReset(resetIdentifier);
      setAdminPasswordResetSuccess(
        `Reset link sent to ${resetResult.email}. Check Spam/Junk if it is not in Inbox.`
      );
    } catch (error) {
      setAdminPasswordResetError(
        getProfileActionErrorMessage(error, "Could not send password reset email.")
      );
    } finally {
      setIsAdminPasswordResetSending(false);
    }
  };
  const handleAdminThemeSongUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";

    if (!file || !activeProfile) {
      return;
    }

    if (!isSupabaseConfigured) {
      setAdminThemeSongError(getSupabaseThemeMusicUnavailableMessage());
      setAdminThemeSongSuccess(null);
      return;
    }

    const targetUid = activeProfile.uid || visibleCurrentUser?.uid;

    if (!targetUid) {
      setAdminThemeSongError("Could not resolve the target account for music upload.");
      setAdminThemeSongSuccess(null);
      return;
    }

    setAdminThemeSongError(null);
    setAdminThemeSongSuccess(null);
    setIsAdminThemeSongUploading(true);

    try {
      const uploadedTrack = await uploadSupabaseProfileThemeAudio(file, targetUid);
      setAdminThemeSongInput(uploadedTrack.publicUrl);
      setAdminThemeSongSuccess("Track uploaded. Click Save Music to apply.");
    } catch (error) {
      setAdminThemeSongError(
        getProfileActionErrorMessage(error, "Could not upload profile music.")
      );
    } finally {
      setIsAdminThemeSongUploading(false);
    }
  };

  const handleAdminThemeSongSave = async () => {
    const bridge = getWindowState().sakuraFirebaseAuth;

    if (!bridge || !canOpenAdminPanel || !activeProfile?.profileId) {
      return;
    }

    if (typeof bridge.adminUpdateProfileThemeSong !== "function") {
      setAdminThemeSongError("Profile music update is unavailable in the current runtime.");
      setAdminThemeSongSuccess(null);
      return;
    }

    const normalizedThemeSongKey = normalizeProfileThemeSongKey(adminThemeSongInput);

    if (adminThemeSongInput.trim() && !normalizedThemeSongKey) {
      setAdminThemeSongError("Select a valid profile track key, SoundCloud URL, or direct audio URL.");
      setAdminThemeSongSuccess(null);
      return;
    }

    setAdminThemeSongError(null);
    setAdminThemeSongSuccess(null);
    setIsAdminThemeSongSaving(true);

    const currentThemeSongRaw =
      typeof activeProfile.themeSongKey === "string" ? activeProfile.themeSongKey : "";
    const previousMusicPath = resolveSupabasePublicObjectPath(
      getAdminThemeSongInputValue(currentThemeSongRaw)
    );

    try {
      const snapshot = await bridge.adminUpdateProfileThemeSong(
        activeProfile.profileId,
        normalizedThemeSongKey ?? ""
      );

      applyUpdatedProfileSnapshot(snapshot);
      setAdminThemeSongInput(
        getAdminThemeSongInputValue(
          normalizeProfileThemeSongKey(snapshot?.themeSongKey) ??
            (typeof activeProfile.profileId === "number"
              ? PROFILE_THEME_DEFAULT_KEY_BY_PROFILE_ID.get(activeProfile.profileId) ?? ""
              : "")
        )
      );

      const nextThemeSongRaw =
        typeof snapshot?.themeSongKey === "string" ? snapshot.themeSongKey : "";
      const nextMusicPath = resolveSupabasePublicObjectPath(
        getAdminThemeSongInputValue(nextThemeSongRaw)
      );

      if (
        previousMusicPath &&
        previousMusicPath.startsWith("profile-music/") &&
        previousMusicPath !== nextMusicPath
      ) {
        void deleteSupabaseStorageObject(previousMusicPath).catch((cleanupError) => {
          console.error("Failed to cleanup replaced profile music object:", cleanupError);
        });
      }

      setAdminThemeSongSuccess(
        normalizedThemeSongKey ? "Profile music updated." : "Profile music reset to default."
      );
    } catch (error) {
      setAdminThemeSongError(
        getProfileActionErrorMessage(error, "Could not update profile music.")
      );
    } finally {
      setIsAdminThemeSongSaving(false);
    }
  };
  const handleAdminThemeSongDelete = async () => {
    const bridge = getWindowState().sakuraFirebaseAuth;

    if (!bridge || !canOpenAdminPanel || !activeProfile?.profileId) {
      return;
    }

    if (isAdminThemeSongDeleteLocked) {
      setAdminThemeSongError("Preset tracks cannot be deleted.");
      setAdminThemeSongSuccess(null);
      return;
    }

    if (typeof bridge.adminUpdateProfileThemeSong !== "function") {
      setAdminThemeSongError("Profile music update is unavailable in the current runtime.");
      setAdminThemeSongSuccess(null);
      return;
    }

    setAdminThemeSongError(null);
    setAdminThemeSongSuccess(null);
    setIsAdminThemeSongDeleting(true);

    const currentThemeSongRaw =
      typeof activeProfile.themeSongKey === "string" ? activeProfile.themeSongKey : "";
    const candidateUrls = [
      getAdminThemeSongInputValue(adminThemeSongInput),
      getAdminThemeSongInputValue(currentThemeSongRaw),
    ];
    const candidatePaths = Array.from(
      new Set(
        candidateUrls
          .map((url) => resolveSupabasePublicObjectPath(url))
          .filter((value): value is string => Boolean(value))
          .filter((value) => value.startsWith("profile-music/"))
      )
    );

    try {
      const snapshot = await bridge.adminUpdateProfileThemeSong(activeProfile.profileId, "");
      applyUpdatedProfileSnapshot(snapshot);
      setAdminThemeSongInput(
        getAdminThemeSongInputValue(
          normalizeProfileThemeSongKey(snapshot?.themeSongKey) ??
            (typeof activeProfile.profileId === "number"
              ? PROFILE_THEME_DEFAULT_KEY_BY_PROFILE_ID.get(activeProfile.profileId) ?? ""
              : "")
        )
      );

      if (candidatePaths.length > 0) {
        await Promise.all(
          candidatePaths.map((path) =>
            deleteSupabaseStorageObject(path).catch((cleanupError) => {
              console.error("Failed to delete profile music object:", cleanupError);
            })
          )
        );
      }

      setAdminThemeSongSuccess("Profile track deleted.");
    } catch (error) {
      setAdminThemeSongError(
        getProfileActionErrorMessage(error, "Could not delete profile music.")
      );
    } finally {
      setIsAdminThemeSongDeleting(false);
    }
  };

  const handleDeleteAccount = async () => {
    const bridge = getWindowState().sakuraFirebaseAuth;

    if (!bridge || !canOpenAdminPanel) {
      return;
    }

    const targetLabel = activeProfile?.login || `#${activeProfile?.profileId ?? ""}`;
    const confirmPrompt = isAdminSelfTarget
      ? t(
          "Are you sure you want to permanently delete your account? All data and subscriptions will be lost forever.",
          "Вы уверены, что хотите безвозвратно удалить свой аккаунт? Все данные и подписки будут стёрты навсегда."
        )
      : t(
          `Are you sure you want to permanently delete account ${targetLabel}? All data will be deleted forever.`,
          `Вы уверены, что хотите безвозвратно удалить аккаунт ${targetLabel}? Все данные и доступ будут стёрты навсегда.`
        );

    if (!window.confirm(confirmPrompt)) {
      return;
    }

    setDeleteAccountError(null);
    setIsAccountDeleting(true);

    try {
      if (isAdminSelfTarget) {
        clearAllCachedProfileSnapshots();
        await bridge.deleteCurrentAccount();
        setIsAdminPanelOpen(false);
        setIsEditProfileModalOpen(false);
        router.replace("/");
      } else if (activeProfile?.profileId && bridge.adminDeleteProfile) {
        clearAllCachedProfileSnapshots();
        await bridge.adminDeleteProfile(activeProfile.profileId);
        setIsAdminPanelOpen(false);
        router.replace("/profile");
      }
    } catch (error) {
      setDeleteAccountError(
        getProfileActionErrorMessage(
          error,
          t(
            "Could not delete account.",
            "Не удалось удалить аккаунт."
          )
        )
      );
    } finally {
      setIsAccountDeleting(false);
    }
  };
  const handleBanToggle = async () => {
    const bridge = getWindowState().sakuraFirebaseAuth;

    if (!bridge || !canOpenAdminPanel || !activeProfile?.profileId) {
      return;
    }

    if (isAdminSelfTarget && !isTargetBanned) {
      setBanError("You cannot ban your own account.");
      setBanSuccess(null);
      return;
    }

    setBanError(null);
    setBanSuccess(null);
    setIsBanSaving(true);

    try {
      const snapshot = await bridge.adminSetProfileBan(activeProfile.profileId, !isTargetBanned);

      applyUpdatedProfileSnapshot(snapshot);
      setBanSuccess(isTargetBanned ? "Account unbanned." : "Account banned.");
    } catch (error) {
      setBanError(error instanceof Error ? error.message : "Could not update the ban status.");
    } finally {
      setIsBanSaving(false);
    }
  };
  const handleAdminVerificationToggle = async () => {
    const bridge = getWindowState().sakuraFirebaseAuth;

    if (!bridge || !canOpenAdminPanel || !activeProfile?.profileId) {
      return;
    }

    setAdminVerificationError(null);
    setAdminVerificationSuccess(null);
    setIsAdminVerificationSaving(true);

    try {
      const snapshot = await bridge.adminSetProfileEmailVerification(
        activeProfile.profileId,
        isTargetVerificationLocked
      );

      applyUpdatedProfileSnapshot(snapshot);
      setAdminVerificationSuccess(
        isTargetVerificationLocked ? "Email marked as verified." : "Email verification revoked."
      );
    } catch (error) {
      setAdminVerificationError(
        error instanceof Error
          ? error.message
          : "Could not update email verification status."
      );
    } finally {
      setIsAdminVerificationSaving(false);
    }
  };

  const handleCommentSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const bridge = getWindowState().sakuraFirebaseAuth;
    const nextComment = commentInput.trim();
    const nextCommentMediaFile = commentMediaFile;

    if (!bridge || !activeProfile?.profileId) {
      return;
    }

    if (!nextComment && !nextCommentMediaFile) {
      setCommentError("Write a comment or attach media before sending.");
      return;
    }

    setCommentError(null);
    setCommentSuccess(null);
    setIsCommentSubmitting(true);

    const pendingCommentId = createPendingCommentId();
    const pendingCommentAuthor = visibleCurrentUser ?? currentUser ?? activeProfile;
    const pendingCommentMediaPreviewUrl = nextCommentMediaFile
      ? URL.createObjectURL(nextCommentMediaFile)
      : null;
    const pendingComment: ProfileComment = {
      id: pendingCommentId,
      profileId: activeProfile.profileId,
      authorUid: pendingCommentAuthor?.uid ?? null,
      authorProfileId:
        typeof pendingCommentAuthor?.profileId === "number"
          ? pendingCommentAuthor.profileId
          : null,
      authorName: profileNameOf(pendingCommentAuthor),
      authorPhotoURL: resolveProfileAvatarUrl(pendingCommentAuthor),
      authorAccentRole: pickCommentAuthorAccentRole(pendingCommentAuthor.roles) ?? null,
      message: nextComment,
      mediaURL: pendingCommentMediaPreviewUrl,
      mediaType: nextCommentMediaFile?.type ?? null,
      mediaPath: null,
      mediaSize: nextCommentMediaFile?.size ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: null,
      pending: true,
    };
    setComments((currentComments) => [pendingComment, ...currentComments]);
    setCommentInput("");
    setCommentMediaFile(null);
    if (commentMediaInputRef.current) {
      commentMediaInputRef.current.value = "";
    }

    let uploadedMedia: SupabaseCommentMediaUploadResult | null = null;

    try {
      let nextMedia: File | CommentMediaPayload | null = nextCommentMediaFile;
      let usedInlineMediaFallback = false;

      if (nextCommentMediaFile && isSupabaseConfigured && visibleCurrentUser?.uid) {
        try {
          uploadedMedia = await uploadSupabaseCommentMedia(
            nextCommentMediaFile,
            visibleCurrentUser.uid
          );
          nextMedia = toCommentMediaPayload(uploadedMedia);
        } catch (error) {
          if (isNetworkFetchError(error)) {
            nextMedia = nextCommentMediaFile;
            usedInlineMediaFallback = true;
          } else {
            throw error;
          }
        }
      }

      const savedComment = await bridge.addProfileComment(
        activeProfile.profileId,
        nextComment,
        nextMedia
      );
      setComments((currentComments) => [
        savedComment,
        ...currentComments.filter(
          (comment) => comment.id !== savedComment.id && comment.id !== pendingCommentId
        ),
      ]);
      setCommentSuccess(
        usedInlineMediaFallback
          ? "Comment posted. Attachment used compatibility mode while storage was unreachable."
          : "Comment posted."
      );
    } catch (error) {
      if (uploadedMedia && shouldCleanupUploadedMedia(uploadedMedia)) {
        void deleteSupabaseCommentMedia(uploadedMedia.path).catch((cleanupError) => {
          console.error("Failed to cleanup uploaded comment media:", cleanupError);
        });
      }

      setComments((currentComments) =>
        currentComments.filter((comment) => comment.id !== pendingCommentId)
      );
      setCommentInput(nextComment);
      if (nextCommentMediaFile) {
        setCommentMediaFile(nextCommentMediaFile);
      }
      setCommentError(
        getErrorCode(error) === "comments/write-denied"
          ? getCommentWriteDeniedMessage(Boolean(nextCommentMediaFile))
          : getProfileActionErrorMessage(error, "Could not post this comment.")
      );
    } finally {
      if (pendingCommentMediaPreviewUrl) {
        URL.revokeObjectURL(pendingCommentMediaPreviewUrl);
      }
      setIsCommentSubmitting(false);
    }
  };

  const handleCommentMediaChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    setCommentError(null);
    setCommentSuccess(null);
    setCommentMediaFile(nextFile);
  };

  const clearCommentMediaSelection = () => {
    setCommentMediaFile(null);
    if (commentMediaInputRef.current) {
      commentMediaInputRef.current.value = "";
    }
  };

  const deleteCommentMediaIfUnused = async (
    bridge: Bridge,
    mediaPath: string | null | undefined
  ) => {
    const normalizedMediaPath = typeof mediaPath === "string" ? mediaPath.trim() : "";

    if (!normalizedMediaPath) {
      return;
    }

    const isStillReferenced = await bridge.isCommentMediaPathReferenced(normalizedMediaPath);

    if (!isStillReferenced) {
      await deleteSupabaseCommentMedia(normalizedMediaPath);
    }
  };

  const handleCommentDelete = async (commentId: string) => {
    const bridge = getWindowState().sakuraFirebaseAuth;
    const currentComment = comments.find((comment) => comment.id === commentId) ?? null;

    if (!bridge || !commentId || !visibleCurrentUser) {
      return;
    }

    setCommentError(null);
    setCommentSuccess(null);
    setDeletingCommentId(commentId);

    try {
      const deletedCommentId = await bridge.deleteProfileComment(commentId);
      const resolvedCommentId = deletedCommentId ?? commentId;

      setComments((currentComments) =>
        currentComments.filter((comment) => comment.id !== resolvedCommentId)
      );
      if (editingCommentId === resolvedCommentId) {
        setEditingCommentId(null);
        setEditingCommentMessage("");
        setEditingCommentMediaFile(null);
        setEditingCommentMediaPreviewUrl(null);
        setIsEditingCommentMediaRemoved(false);
      }

      setCommentSuccess("Comment deleted.");
      setConfirmingCommentDeleteId((currentId) => (currentId === resolvedCommentId ? null : currentId));
      setOpenCommentActionsMenuId((currentId) => (currentId === resolvedCommentId ? null : currentId));

      if (currentComment?.mediaPath) {
        void deleteCommentMediaIfUnused(bridge, currentComment.mediaPath).catch((cleanupError) => {
          console.error("Failed to remove deleted comment media:", cleanupError);
        });
      }
    } catch (error) {
      setCommentError(getProfileActionErrorMessage(error, "Could not delete this comment."));
    } finally {
      setDeletingCommentId((currentId) => (currentId === commentId ? null : currentId));
    }
  };

  const requestCommentDeleteConfirmation = (commentId: string) => {
    setCommentError(null);
    setCommentSuccess(null);
    setConfirmingCommentDeleteId(commentId);
    setOpenCommentActionsMenuId(commentId);
  };

  const cancelCommentDeleteConfirmation = (commentId?: string) => {
    setConfirmingCommentDeleteId((currentId) => {
      if (!commentId) {
        return null;
      }

      return currentId === commentId ? null : currentId;
    });
    setOpenCommentActionsMenuId((currentId) => {
      if (!commentId) {
        return null;
      }

      return currentId === commentId ? commentId : currentId;
    });
  };

  const handleCommentEditStart = (comment: ProfileComment) => {
    setCommentError(null);
    setCommentSuccess(null);
    setConfirmingCommentDeleteId((currentId) => (currentId === comment.id ? null : currentId));
    setOpenCommentActionsMenuId((currentId) => (currentId === comment.id ? null : currentId));
    setEditingCommentId(comment.id);
    setEditingCommentMessage(comment.message);
    setEditingDraftMentionProfilesByKey((currentProfiles) =>
      filterComposerMentionProfilesByValue(comment.message, currentProfiles)
    );
    setEditingCommentMediaFile(null);
    setEditingCommentMediaPreviewUrl(null);
    setIsEditingCommentMediaRemoved(false);
    if (editingCommentMediaInputRef.current) {
      editingCommentMediaInputRef.current.value = "";
    }
  };

  const handleCommentEditCancel = () => {
    setEditingCommentId(null);
    setEditingCommentMessage("");
    setEditingDraftMentionProfilesByKey({});
    setEditingCommentMediaFile(null);
    setEditingCommentMediaPreviewUrl(null);
    setIsEditingCommentMediaRemoved(false);
    if (editingCommentMediaInputRef.current) {
      editingCommentMediaInputRef.current.value = "";
    }
  };

  const handleEditingCommentMediaChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    setCommentError(null);
    setCommentSuccess(null);
    setEditingCommentMediaFile(nextFile);
    if (nextFile) {
      setIsEditingCommentMediaRemoved(false);
    }
  };

  const clearEditingCommentMediaSelection = () => {
    setEditingCommentMediaFile(null);
    if (editingCommentMediaInputRef.current) {
      editingCommentMediaInputRef.current.value = "";
    }
  };

  const removeEditingCommentMedia = () => {
    setEditingCommentMediaFile(null);
    setEditingCommentMediaPreviewUrl(null);
    setIsEditingCommentMediaRemoved(true);
    if (editingCommentMediaInputRef.current) {
      editingCommentMediaInputRef.current.value = "";
    }
  };

  const handleCommentUpdate = async (commentId: string) => {
    const bridge = getWindowState().sakuraFirebaseAuth;
    const nextMessage = editingCommentMessage.trim();
    const currentComment = comments.find((comment) => comment.id === commentId) ?? null;
    const hasExistingCommentMedia = Boolean(
      currentComment &&
        (
          (typeof currentComment.mediaURL === "string" && currentComment.mediaURL.trim()) ||
          (typeof currentComment.mediaPath === "string" && currentComment.mediaPath.trim())
        )
    );
    const willKeepExistingMedia =
      hasExistingCommentMedia &&
      !editingCommentMediaFile &&
      !isEditingCommentMediaRemoved;
    const willHaveMedia = Boolean(editingCommentMediaFile) || willKeepExistingMedia;

    if (!bridge || !commentId) {
      return;
    }

    if (!nextMessage && !willHaveMedia) {
      setCommentError("Write a comment or attach media before saving.");
      return;
    }

    setCommentError(null);
    setCommentSuccess(null);
    setIsCommentUpdating(true);

    let uploadedMedia: SupabaseCommentMediaUploadResult | null = null;

    try {
      let nextMedia: File | CommentMediaPayload | null = editingCommentMediaFile;
      let usedInlineMediaFallback = false;

      if (editingCommentMediaFile && isSupabaseConfigured && visibleCurrentUser?.uid) {
        try {
          uploadedMedia = await uploadSupabaseCommentMedia(
            editingCommentMediaFile,
            visibleCurrentUser.uid
          );
          nextMedia = toCommentMediaPayload(uploadedMedia);
        } catch (error) {
          if (isNetworkFetchError(error)) {
            nextMedia = editingCommentMediaFile;
            usedInlineMediaFallback = true;
          } else {
            throw error;
          }
        }
      }

      const updatedComment = await bridge.updateProfileComment(
        commentId,
        nextMessage,
        nextMedia,
        isEditingCommentMediaRemoved
      );

      if (!updatedComment) {
        if (uploadedMedia && shouldCleanupUploadedMedia(uploadedMedia)) {
          void deleteSupabaseCommentMedia(uploadedMedia.path).catch((cleanupError) => {
            console.error("Failed to cleanup uploaded comment media:", cleanupError);
          });
        }

        setCommentError("This comment no longer exists.");
        return;
      }

      setComments((currentComments) =>
        currentComments.map((comment) =>
          comment.id === updatedComment.id ? updatedComment : comment
        )
      );

      setEditingCommentId(null);
      setEditingCommentMessage("");
      setEditingCommentMediaFile(null);
      setEditingCommentMediaPreviewUrl(null);
      setIsEditingCommentMediaRemoved(false);
      if (editingCommentMediaInputRef.current) {
        editingCommentMediaInputRef.current.value = "";
      }
      setCommentSuccess(
        usedInlineMediaFallback
          ? "Comment updated. Attachment used compatibility mode while storage was unreachable."
          : "Comment updated."
      );

      if (currentComment?.mediaPath && (Boolean(uploadedMedia?.path) || isEditingCommentMediaRemoved)) {
        void deleteCommentMediaIfUnused(bridge, currentComment.mediaPath).catch((cleanupError) => {
          console.error("Failed to remove replaced comment media:", cleanupError);
        });
      }
    } catch (error) {
      if (uploadedMedia && shouldCleanupUploadedMedia(uploadedMedia)) {
        void deleteSupabaseCommentMedia(uploadedMedia.path).catch((cleanupError) => {
          console.error("Failed to cleanup uploaded comment media:", cleanupError);
        });
      }

      setCommentError(
        getErrorCode(error) === "comments/write-denied"
          ? getCommentWriteDeniedMessage(
              Boolean(editingCommentMediaFile) ||
              Boolean(hasExistingCommentMedia && !isEditingCommentMediaRemoved)
            )
          : getProfileActionErrorMessage(error, "Could not update this comment.")
      );
    } finally {
      setIsCommentUpdating(false);
    }
  };

  const postProfileThemeEmbedCommand = useCallback((command: "play" | "pause" | "seek" | "volume", value?: number) => {
    const frameWindow = profileThemeEmbedFrameRef.current?.contentWindow;

    if (!frameWindow || !profileThemeUsesEmbeddedPlayer || !profileThemeEmbedProvider) {
      return;
    }

    if (profileThemeEmbedProvider === "youtube" || profileThemeEmbedProvider === "vk") {
      const func =
        command === "play"
          ? "playVideo"
          : command === "pause"
            ? "pauseVideo"
            : command === "seek"
              ? "seekTo"
              : "setVolume";
      const args =
        command === "seek"
          ? [Math.max(0, typeof value === "number" && Number.isFinite(value) ? value : 0), true]
          : command === "volume"
            ? [Math.round(Math.max(0, Math.min(1, typeof value === "number" && Number.isFinite(value) ? value : 0)) * 100)]
            : [];

      frameWindow.postMessage(JSON.stringify({ event: "command", func, args }), "*");
      return;
    }

    if (profileThemeEmbedProvider === "soundcloud") {
      const payload =
        command === "seek"
          ? { method: "seekTo", value: Math.max(0, typeof value === "number" && Number.isFinite(value) ? value : 0) * 1000 }
          : command === "volume"
            ? {
                method: "setVolume",
                value: Math.round(Math.max(0, Math.min(1, typeof value === "number" && Number.isFinite(value) ? value : 0)) * 100),
              }
            : { method: command };

      frameWindow.postMessage(JSON.stringify(payload), "*");
      return;
    }

    const genericPayload = {
      command,
      value,
    };

    frameWindow.postMessage(genericPayload, "*");
    frameWindow.postMessage(JSON.stringify(genericPayload), "*");
  }, [profileThemeEmbedProvider, profileThemeUsesEmbeddedPlayer]);

  const handleProfileThemeToggle = async () => {
    if (profileThemeUsesEmbeddedPlayer) {
      const nextIsPlaying = !profileThemeIsPlaying;
      setProfileThemeIsPlaying(nextIsPlaying);


      postProfileThemeEmbedCommand(nextIsPlaying ? "play" : "pause");
      return;
    }

    const audio = profileThemeAudioRef.current;

    if (!audio || !shouldPlayProfileThemeSong || !profileThemeUsesNativeAudio) {
      return;
    }

    if (audio.paused) {
      try {
        await audio.play();
      } catch (error) {
      }
      return;
    }

    audio.pause();
  };

  const handleProfileThemeSeek = (event: ChangeEvent<HTMLInputElement>) => {
    const audio = profileThemeAudioRef.current;
    const nextTime = Number(event.target.value);

    setProfileThemeCurrentTime(nextTime);

    if (profileThemeUsesEmbeddedPlayer && Number.isFinite(nextTime)) {
      postProfileThemeEmbedCommand("seek", nextTime);
      return;
    }

    if (audio && Number.isFinite(nextTime)) {
      audio.currentTime = nextTime;
    }
  };

  const handleProfileThemeVolumeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextVolume = Number(event.target.value);
    const normalizedVolume = Math.min(1, Math.max(0, Number.isFinite(nextVolume) ? nextVolume : 0));

    setProfileThemeVolume(normalizedVolume);

    if (profileThemeUsesEmbeddedPlayer) {
      postProfileThemeEmbedCommand("volume", normalizedVolume);
      return;
    }

    if (profileThemeAudioRef.current) {
      profileThemeAudioRef.current.volume = normalizedVolume;
    }
  };
  const handleFunPayLinkClick = useCallback(() => {
    const audio = funPayTrackAudioRef.current;

    if (!audio) {
      return;
    }

    audio.currentTime = 0;
    void audio.play().catch(() => {
    });
  }, []);
  return (
    <main
      data-profile-build={PROFILE_BUILD_MARKER}
      className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(255,183,197,0.14),transparent_35%),linear-gradient(180deg,#090909_0%,#040404_100%)] px-5 py-8 text-white sm:px-8"
    >
      <script
        dangerouslySetInnerHTML={{
          __html: restoreProfilePathScript,
        }}
      />
      <audio
        ref={profileThemeAudioRef}
        src={profileThemeUsesNativeAudio ? profileThemeSongSrc ?? undefined : undefined}
        preload="auto"
        aria-hidden="true"
        className="hidden"
      />
      <audio
        ref={funPayTrackAudioRef}
        src={FUNPAY_DONATION_TRACK_SRC}
        preload="auto"
        aria-hidden="true"
        className="hidden"
      />
      {shouldRenderHiddenThemeEmbed ? (
        <iframe
          ref={profileThemeEmbedFrameRef}
          src={profileThemeActiveEmbedUrl ?? undefined}
          title={profileThemeTitle ?? "Profile Theme"}
          loading="lazy"
          tabIndex={-1}
          aria-hidden="true"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          style={{ width: 320, height: Math.max(152, Math.min(profileThemeEmbedHeight, 352)) }}
          className="pointer-events-none fixed -left-[9999px] top-0 border-0 opacity-0"
        />
      ) : null}
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4">
          <div className="relative">
            <nav className="flex flex-col gap-4 rounded-[28px] border border-[#1b1b1b] bg-black/40 px-6 py-5 backdrop-blur-sm md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-4">
                <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-90">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#ffb7c5]/40 bg-[#160d11] p-1 shadow-[0_0_18px_rgba(255,183,197,0.25)]">
                    <SakuraIcon className="h-full w-full" />
                  </span>
                  <span className="text-base font-black uppercase tracking-tight text-[#ffb7c5] hidden sm:inline">
                    Sakura
                  </span>
                </Link>
                <div className="h-4 w-px bg-white/10 hidden sm:block" />
                <HeaderSocialLinks showLabel />
              </div>
              <div className="flex flex-wrap items-center justify-end gap-3">
                <Link href="/" className="inline-flex items-center justify-center rounded-full border border-[#2a2a2a] bg-[#101010] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-gray-300 transition hover:border-[#4a4a4a] hover:text-white">Home</Link>
                <Link href="/changelog" className="inline-flex items-center justify-center rounded-full border border-[#2a2a2a] bg-[#101010] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-gray-300 transition hover:border-[#4a4a4a] hover:text-white">{t("Changelog", "Патчноуты")}</Link>
                {visibleCurrentUser?.profileId && !isOwner ? <a href={profilePath(visibleCurrentUser.profileId)} className="inline-flex items-center justify-center rounded-full border border-[#2b1b1e] bg-[#1a1012] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#ffb7c5] transition hover:border-[#ffb7c5]/40 hover:text-white">My Profile</a> : null}
                {visibleCurrentUser ? <button type="button" onClick={handleLogout} disabled={isLoggingOut} className="inline-flex items-center justify-center rounded-full border border-[#ffb7c5]/30 bg-[#ffb7c5] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-black transition hover:bg-[#ffc8d3] disabled:cursor-not-allowed disabled:opacity-60">{isLoggingOut ? t("Logging out...", "Выход...") : t("Logout", "Выход")}</button> : null}
              </div>
            </nav>
            <button
              type="button"
              onClick={toggleHeaderProfileSearch}
              aria-expanded={isHeaderProfileSearchOpen}
              aria-controls="header-profile-search-modal"
              aria-label="Search profiles"
              title="Search profiles"
              className={`absolute -right-[58px] top-[22px] z-30 hidden h-11 w-11 items-center justify-center rounded-full border border-transparent bg-transparent text-lg shadow-none transition duration-200 lg:inline-flex ${isHeaderProfileSearchOpen ? "border-[#2b1b1e] bg-[#140d11] text-[#ffb7c5]" : "text-[#ffb7c5]/80 hover:border-[#2b1b1e] hover:bg-[#140d11] hover:text-[#ffb7c5] hover:shadow-[0_0_18px_rgba(255,183,197,0.14)]"}`}
            >
              <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 fill-current">
                <path d="M11.9 10.8 15 13.9 13.9 15l-3.1-3.1a5.9 5.9 0 1 1 1.1-1.1ZM6.6 11A4.4 4.4 0 1 0 6.6 2a4.4 4.4 0 0 0 0 8.8Z" />
              </svg>
            </button>

            {isHeaderProfileSearchOpen ? (
              <div
                className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-sm"
                onClick={closeHeaderProfileSearch}
              >
                <div
                  id="header-profile-search-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Profile search"
                  onClick={(event) => event.stopPropagation()}
                  className="w-full max-w-[620px] rounded-[24px] border border-[#24171b] bg-[radial-gradient(circle_at_top_left,rgba(255,183,197,0.14),transparent_62%),#090909] p-3.5 shadow-[0_0_72px_rgba(0,0,0,0.55)] sm:p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#b78a95]">Find Account</p>
                    <button
                      type="button"
                      onClick={closeHeaderProfileSearch}
                      className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#2d1f24] bg-[#120d10] text-[#ffb7c5] transition hover:border-[#ffb7c5]/45 hover:text-white"
                    >
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute left-1/2 top-1/2 h-[1.5px] w-3.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full bg-current"
                      />
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute left-1/2 top-1/2 h-[1.5px] w-3.5 -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded-full bg-current"
                      />
                    </button>
                  </div>

                  <form
                    onSubmit={handleHeaderProfileSearchSubmit}
                    aria-busy={isHeaderProfileSearchLoading}
                    className="mt-3 mx-auto w-full max-w-[500px]"
                  >
                    <label className="min-w-0 flex-1">
                      <span className="sr-only">Search profiles</span>
                      <input
                        ref={headerProfileSearchInputRef}
                        type="text"
                        value={headerProfileSearchQuery}
                        onChange={(event) => {
                          const nextQuery = event.target.value;
                          setHeaderProfileSearchQuery(nextQuery);
                          setHeaderProfileSearchError(null);
                          setHeaderProfileSearchFeedback(null);
                        }}
                        className="w-full rounded-2xl border border-[#232323] bg-[#090909] px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-[#ffb7c5]/55"
                        placeholder="UID, login, or username"
                      />
                    </label>
                  </form>

                  {headerProfileSearchError ? (
                    <p className="mt-3 text-xs leading-relaxed text-[#ff9aa9]">{headerProfileSearchError}</p>
                  ) : null}
                  {!headerProfileSearchError && headerProfileSearchFeedback ? (
                    <p className="mt-3 text-xs leading-relaxed text-gray-500">{headerProfileSearchFeedback}</p>
                  ) : null}

                  {headerProfileSearchResults.length ? (
                    <div className="mt-4 max-h-[46vh] space-y-2 overflow-y-auto pr-1">
                      {headerProfileSearchResults.map((candidateProfile, index) => {
                        const candidateProfileId =
                          typeof candidateProfile.profileId === "number" ? candidateProfile.profileId : null;
                        const isNavigable = typeof candidateProfileId === "number";
                        const candidateKey = profileSearchIdentityKey(candidateProfile) || `candidate-${index}`;
                        const candidateDisplayName = profileNameOf(candidateProfile);
                        const candidateLoginLine = candidateProfile.login
                          ? `@${candidateProfile.login}`
                          : "No login";
                        const candidateRole = deriveVisibleProfileRoles(candidateProfile)[0] ?? "user";
                        const candidateAvatarUrl = resolveProfileAvatarUrl(candidateProfile);
                        const candidateInitials = initialsOf(candidateProfile);
                        const candidateBody = <>
                          <span className="min-w-0 flex min-h-0 flex-1 items-center gap-3">
                            {candidateAvatarUrl ? (
                              <AvatarMedia
                                src={candidateAvatarUrl}
                                alt={candidateDisplayName}
                                loading="lazy"
                                decoding="async"
                                className="h-10 w-10 shrink-0 rounded-2xl border border-[#2a2022] object-cover"
                              />
                            ) : (
                              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#2a2022] bg-[#171012] text-[11px] font-black uppercase text-[#ffb7c5]">
                                {candidateInitials}
                              </span>
                            )}
                            <span className="min-w-0">
                              <span style={roleCommentAuthorStyle(candidateRole)} className="block truncate text-sm font-semibold">
                                {candidateDisplayName}
                              </span>
                              <span className="block truncate text-xs text-gray-500">{candidateLoginLine}</span>
                            </span>
                          </span>
                          <span className="inline-flex shrink-0 items-center gap-1.5 text-[10px] text-[#b78a95]">
                            <span aria-hidden="true" className="inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-[#ff9fbd] shadow-[0_0_10px_rgba(255,159,189,0.7)]" />
                            <span className="whitespace-nowrap">{isNavigable ? `UID: ${candidateProfileId}` : "UID unavailable"}</span>
                          </span>
                        </>;

                        return isNavigable ? (
                          <a
                            key={candidateKey}
                            href={profilePath(candidateProfileId)}
                            onClick={closeHeaderProfileSearch}
                            className="flex items-center justify-between gap-3 rounded-2xl border border-[#222] bg-[#0b0b0b] px-3 py-2.5 transition hover:border-[#ffb7c5]/35"
                          >
                            {candidateBody}
                          </a>
                        ) : (
                          <div key={candidateKey} className="flex items-center justify-between gap-3 rounded-2xl border border-[#1e1e1e] bg-[#0b0b0b]/70 px-3 py-2.5 opacity-80">
                            {candidateBody}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {authError ? <section className="rounded-[32px] border border-red-400/20 bg-red-500/10 px-8 py-12"><p className="font-mono text-[10px] uppercase tracking-[0.4em] text-[#ffb7c5]">Auth Error</p><p className="mt-4 text-sm leading-relaxed text-red-100/85">{authError}</p></section> : null}
        {hasHydrated && showPendingState ? <section className="rounded-[32px] border border-[#181818] bg-[#090909]/85 px-6 py-5 shadow-[0_0_40px_rgba(255,183,197,0.04)]"><div className="flex items-center justify-between gap-4"><div><p className="font-mono text-[10px] uppercase tracking-[0.34em] text-[#ffb7c5]">Loading</p><p className="mt-2 text-sm text-gray-400">{requestedProfileId ? `Preparing profile #${requestedProfileId}...` : "Preparing profile..."}</p></div><div className="h-2 w-2 rounded-full bg-[#ffb7c5] animate-pulse"></div></div></section> : null}
        {hasHydrated && authReady && !authError && !isProfileLoading && !activeProfile && profileError ? (
          <section className="rounded-[32px] border border-[#201517] bg-[#0d0d0d] px-8 py-12 shadow-[0_0_60px_rgba(255,183,197,0.06)]">
            <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-[#ffb7c5]">
              {requestedProfileId ? t("Profile Missing", "Профиль не найден") : t("Guest State", "Гостевой режим")}
            </p>
            <p className="mt-4 text-sm leading-relaxed text-gray-400">{profileError}</p>
            {visibleCurrentUser?.profileId && (
              <div className="mt-6">
                <a
                  href={profilePath(visibleCurrentUser.profileId)}
                  className="inline-flex items-center gap-2 rounded-full border border-[#ffb7c5]/40 bg-[#ffb7c5] px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-black transition hover:bg-white"
                >
                  {t("Back to my profile", "Вернуться в свой профиль")}
                </a>
              </div>
            )}
          </section>
        ) : null}

        {activeProfile ? (
          <section className="relative flex flex-col gap-6">
            {typeof activeProfile.profileId === "number" && activeProfile.profileId > 1 && previousProfileId !== null ? (
              typeof previousProfileId === "number" ? (
                <a
                  href={profilePath(previousProfileId)}
                  aria-label="Open previous account"
                  className="absolute -left-[58px] top-[24px] z-30 hidden h-11 w-11 items-center justify-center rounded-full border border-transparent bg-transparent text-base text-[#ffb7c5]/88 transition duration-200 hover:border-[#ffb7c5]/45 hover:bg-[#1a1012] hover:text-white hover:shadow-[0_0_16px_rgba(255,183,197,0.1)] lg:inline-flex"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </a>
              ) : (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -left-[58px] top-[24px] z-30 hidden h-11 w-11 items-center justify-center rounded-full border border-transparent bg-transparent text-base text-[#ffb7c5]/38 lg:inline-flex"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </span>
              )
            ) : null}
            {nextProfileId !== null ? (
              typeof nextProfileId === "number" ? (
                <a
                  href={profilePath(nextProfileId)}
                  aria-label="Open next account"
                  className="absolute -right-[58px] top-[24px] z-30 hidden h-11 w-11 items-center justify-center rounded-full border border-transparent bg-transparent text-base text-[#ffb7c5]/88 transition duration-200 hover:border-[#ffb7c5]/45 hover:bg-[#1a1012] hover:text-white hover:shadow-[0_0_16px_rgba(255,183,197,0.1)] lg:inline-flex"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </a>
              ) : (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-[58px] top-[24px] z-30 hidden h-11 w-11 items-center justify-center rounded-full border border-transparent bg-transparent text-base text-[#ffb7c5]/38 lg:inline-flex"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </span>
              )
            ) : null}
            {/* Hero Banner Card */}
            <div className="relative z-10 w-full overflow-hidden rounded-[34px] border border-[#201517] bg-[#0d0d0d] shadow-[0_0_80px_rgba(255,183,197,0.06)]">
              {/* Cover Banner */}
              <div className="relative h-[145px] sm:h-[160px] w-full overflow-hidden border-b border-[#1f1418]">
                {hasActiveProfileBanner ? (
                  <img
                    src={activeProfileBannerUrl ?? ""}
                    alt="Profile Banner"
                    className="h-full w-full object-cover object-center"
                  />
                ) : (
                  <div
                    className="relative h-full w-full"
                    style={{
                      background:
                        "radial-gradient(circle at 20% 50%, rgba(255, 183, 197, 0.16), transparent 50%), radial-gradient(circle at 80% 30%, rgba(255, 51, 119, 0.12), transparent 50%), linear-gradient(180deg, #170d13 0%, #0d0d0d 100%)",
                    }}
                  >
                    <div
                      className="absolute inset-0"
                      style={{
                        opacity: 0.18,
                        backgroundImage:
                          "radial-gradient(#ffb7c5 0.75px, transparent 0.75px)",
                        backgroundSize: "16px 16px",
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Card Body / Hero Content */}
              <div className="relative -mt-[50px] flex flex-wrap items-end justify-between gap-5 px-6 pb-7 sm:px-[34px]">
                {/* Left: Avatar Block */}
                <div className="flex shrink-0 flex-col items-center gap-2.5">
                  {hasActiveProfileAvatar ? (
                    <AvatarMedia
                      src={activeProfileAvatarUrl ?? ""}
                      alt={primaryName}
                      loading="eager"
                      decoding="async"
                      className="h-[104px] w-[104px] rounded-[30px] border border-[#2c2023] bg-[#1a1012] object-cover shadow-[0_0_30px_rgba(255,183,197,0.14)]"
                    />
                  ) : (
                    <div className="flex h-[104px] w-[104px] items-center justify-center rounded-[30px] border border-[#2c2023] bg-[#1a1012] text-[26px] font-black uppercase tracking-[-0.02em] text-[#ffb7c5] shadow-[0_0_30px_rgba(255,183,197,0.14)]">
                      {initials}
                    </div>
                  )}
                  <span
                    style={{ minWidth: 104, height: 28 }}
                    className={`inline-flex shrink-0 items-center justify-center rounded-full border px-3.5 text-[10px] font-extrabold uppercase tracking-[0.18em] ${
                      isActiveProfileOnline
                        ? "border-[#1f3b2f] bg-[#0d1713] text-[#8ce5b2]"
                        : "border-[#312228] bg-[#140d11] text-[#ffb7c5]"
                    }`}
                  >
                    {isActiveProfileOnline ? t("Online", "Онлайн") : t("Offline", "Оффлайн")}
                  </span>
                </div>

                {/* Middle: User Info */}
                <div className="min-w-[240px] flex-1 pb-0.5">
                  <h1
                    style={profileHeadlineStyle}
                    className="truncate text-[32px] font-black uppercase tracking-[-0.03em] leading-none text-white"
                  >
                    {primaryName}
                  </h1>
                  {hasUsername ? (
                    <p className="mt-1 text-[13px] font-semibold text-[#c7d4cc]">@{activeProfile.login}</p>
                  ) : isOwner ? (
                    <p className="mt-1 text-xs text-gray-500">
                      {t("Login not set yet.", "Логин ещё не задан.")}
                    </p>
                  ) : null}

                  <div className="mt-2 flex flex-col gap-1 text-[11px] text-[#b78a95]">
                    {typeof activeProfile.profileId === "number" ? (
                      <div className="flex items-center gap-1.5">
                        <span
                          aria-hidden="true"
                          className="inline-flex h-[5px] w-[5px] shrink-0 rounded-full bg-[#ff9fbd] shadow-[0_0_8px_rgba(255,159,189,0.7)]"
                        />
                        <span>UID: {activeProfile.profileId}</span>
                      </div>
                    ) : null}
                    <div className="flex items-center gap-1.5">
                      <span
                        aria-hidden="true"
                        className="inline-flex h-[5px] w-[5px] shrink-0 rounded-full bg-[#ff9fbd] shadow-[0_0_8px_rgba(255,159,189,0.7)]"
                      />
                      <span>
                        {t("Account created", "Аккаунт создан")}{" "}
                        {formatTime(activeProfile.creationTime, locale)}
                      </span>
                    </div>
                  </div>

                  {/* Roles Strip */}
                  <div className="mt-3.5 flex flex-wrap items-center gap-2">
                    {profileRoles.map((role) => (
                      <span
                        key={role}
                        title={roleBadgeLabel(role)}
                        style={{ ...roleBadgeStyle(role), ...roleBadgeTextStyle, height: 28 }}
                        className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full border px-3 text-[10px] font-extrabold tracking-[0.08em]"
                      >
                        <span aria-hidden="true" className="inline-flex items-center">
                          {renderRoleBadgeText(role)}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Right: Hero Actions */}
                <div className="flex shrink-0 items-center gap-3 self-end pb-1">
                  {isOwner && activeProfile && !activeProfile.isBanned ? (
                    <button
                      type="button"
                      onClick={() => setIsEditProfileModalOpen(true)}
                      className="inline-flex items-center gap-2 rounded-full border border-[#ffb7c5]/45 bg-[#ffb7c5] px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.12em] text-[#0a0a0a] shadow-[0_0_24px_rgba(255,183,197,0.28)] transition hover:bg-white hover:scale-102 cursor-pointer"
                    >
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                      >
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                      <span>{t("Edit Profile", "Редактировать профиль")}</span>
                    </button>
                  ) : null}
                  {!isOwner && canOpenAdminPanel ? (
                    <button
                      type="button"
                      onClick={() => {
                        setIsAdminPanelOpen(true);
                        loadAdminPromoCodes();
                      }}
                      className="inline-flex items-center gap-2 rounded-full border border-[#3a222c] bg-[#140d11] px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[#ffb7c5] transition hover:border-[#ffb7c5] hover:text-white cursor-pointer"
                    >
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <path d="M9 3v18" />
                        <path d="M15 3v18" />
                      </svg>
                      <span>{t("Admin Panel", "Панель админа")}</span>
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
            {/* Bento Row: Minimalist Subscription + Compact HWID (For Owner) */}
            {isOwner ? (
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1.1fr)]">
                {/* Card 1: Minimalist Subscription Card */}
                <div className="flex flex-col justify-between rounded-[30px] border border-[#201517] bg-[#0d0a0d] p-6 sm:p-7 shadow-[0_0_60px_rgba(255,183,197,0.04)]">
                  <div>
                    <div className="flex items-center justify-between gap-4 mb-4">
                      <span className="font-mono text-[11px] font-extrabold uppercase tracking-[0.28em] text-[#ffc2cf]">
                        {t("Subscription", "ПОДПИСКА")}
                      </span>
                      {hasLifetimeRole ? (
                        <span className="inline-flex h-7 items-center justify-center rounded-full border border-[#facc15]/50 bg-[#1b1708] px-4 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#fff3c4] shadow-[0_0_18px_rgba(250,204,21,0.24)]">
                          {t("Lifetime", "НАВСЕГДА")}
                        </span>
                      ) : activeProfile?.isFrozen ? (
                        <span className="inline-flex h-7 items-center justify-center rounded-full border border-[#38bdf8]/50 bg-[#082f49] px-4 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#7dd3fc] shadow-[0_0_18px_rgba(56,189,248,0.24)]">
                          {t("Frozen", "ЗАМОРОЖЕНА")}
                        </span>
                      ) : hasActiveSubscriptionRole ? (
                        <span className="inline-flex h-7 items-center justify-center rounded-full border border-[#1f5038] bg-[#0c1812] px-4 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#8ce5b2] shadow-[0_0_18px_rgba(31,122,77,0.22)]">
                          {t("Active", "АКТИВНА")}
                        </span>
                      ) : (
                        <span className="inline-flex h-7 items-center justify-center rounded-full border border-[#38232b] bg-[#140d10] px-4 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#9d858f]">
                          {t("Inactive", "НЕАКТИВНА")}
                        </span>
                      )}
                    </div>

                    <div className="flex items-baseline gap-2 leading-none">
                      {hasLifetimeRole ? (
                        <>
                          <span className="text-[42px] font-black tracking-[-0.03em] text-white">∞</span>
                          <span className="text-base font-bold tracking-[0.02em] text-[#8ce5b2]">{t("Days", "дней")}</span>
                        </>
                      ) : hasActiveSubscriptionRole ? (
                        <>
                          <span className="text-[42px] font-black tracking-[-0.03em] text-white">{remainingDaysCount}</span>
                          <span className="text-base font-bold tracking-[0.02em] text-[#8ce5b2]">{t("Days", "дней")}</span>
                        </>
                      ) : (
                        <>
                          <span className="text-[42px] font-black tracking-[-0.03em] text-[#8a7882]">0</span>
                          <span className="text-base font-bold tracking-[0.02em] text-[#6d5b65]">{t("Days", "дней")}</span>
                        </>
                      )}
                    </div>

                    <div className="mt-1.5 text-xs text-[#8f7a85]">
                      {hasLifetimeRole
                        ? t("Valid until: Permanent access", "Действует до: Бессрочный доступ")
                        : hasActiveSubscriptionRole
                        ? `${t("Valid until:", "Действует до:")} ${profileSubscriptionUntilLabel}`
                        : t("Valid until: No active subscription", "Действует до: Нет активной подписки")}
                    </div>

                    {/* Glowing Progress Bar */}
                    <div className="my-5">
                      {hasActiveSubscriptionRole || hasLifetimeRole ? (
                        <div className="h-[7px] w-full overflow-hidden rounded-full bg-white/[0.06]">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#ff2d75] via-[#ff8fa5] to-[#8ce5b2] shadow-[0_0_14px_rgba(255,45,117,0.45)]"
                            style={{ width: `${subscriptionProgressPercent}%` }}
                          />
                        </div>
                      ) : (
                        <div className="h-[7px] w-full overflow-hidden rounded-full border border-dashed border-[#ffb7c5]/15 bg-white/[0.03]">
                          <div className="h-full w-0" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons Row */}
                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    {hasActiveSubscriptionRole || hasLifetimeRole ? (
                      activeProfile?.isFrozen ? (
                        <>
                          <button
                            type="button"
                            onClick={handleUnfreezeSubscription}
                            disabled={isFreezingSubscription}
                            className="inline-flex items-center justify-center rounded-[18px] bg-[#ff2d75] px-5 py-3 text-[11px] font-black uppercase tracking-[0.12em] text-white shadow-[0_0_26px_rgba(255,45,117,0.4)] transition hover:bg-[#ff4887] hover:scale-102 disabled:opacity-50 cursor-pointer"
                          >
                            {isFreezingSubscription ? t("Unfreezing...", "Размораживаем...") : t("Unfreeze Subscription", "Разморозить")}
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsPromoModalOpen(true)}
                            className="inline-flex items-center gap-1.5 rounded-[18px] border border-[#3a222c] bg-[#140d11] px-4 py-3 text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#ffb7c5] transition hover:border-[#ffb7c5] hover:text-white cursor-pointer"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="4" width="18" height="16" rx="3"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="7" y1="8" x2="11" y2="8"/></svg>
                            <span>{t("Promo Code", "ПРОМОКОД")}</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              window.open("https://github.com", "_blank");
                            }}
                            className="inline-flex items-center justify-center rounded-[18px] bg-[#ff2d75] px-5 py-3 text-[11px] font-black uppercase tracking-[0.12em] text-white shadow-[0_0_26px_rgba(255,45,117,0.4)] transition hover:bg-[#ff4887] hover:scale-102 cursor-pointer"
                          >
                            {t("Download Cheat", "СКАЧАТЬ ЧИТ")}
                          </button>
                          {!hasLifetimeRole && !isTrialSubscription && (
                            isFreezeOnCooldown ? (
                              <button
                                type="button"
                                disabled
                                title={t(
                                  `Freeze cooldown active. Next freeze in ${freezeCooldownDays} days.`,
                                  `Заморозка доступна через ${freezeCooldownDays} дн.`
                                )}
                                className="inline-flex items-center justify-center rounded-[18px] border border-[#281920] bg-[#140d11] px-4 py-3 text-[11px] font-extrabold uppercase tracking-[0.1em] text-gray-500 opacity-60 cursor-not-allowed"
                              >
                                {t(`Freeze (${freezeCooldownDays}d)`, `ЗАМОРОЗКА (${freezeCooldownDays}Д)`)}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={handleFreezeSubscription}
                                disabled={isFreezingSubscription}
                                className="inline-flex items-center justify-center rounded-[18px] border border-[#281920] bg-[#140d11] px-4 py-3 text-[11px] font-extrabold uppercase tracking-[0.1em] text-white transition hover:border-[#ffb7c5]/40 hover:text-[#ffb7c5] cursor-pointer disabled:opacity-50"
                              >
                                {isFreezingSubscription ? t("Freezing...", "ЗАМОРОЗКА...") : t("Freeze", "ЗАМОРОЗИТЬ")}
                              </button>
                            )
                          )}
                          {!hasLifetimeRole && (
                            <>
                              <a
                                href={FUNPAY_SUBSCRIPTION_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={handleFunPayLinkClick}
                                className="inline-flex items-center justify-center rounded-[18px] border border-[#281920] bg-[#140d11] px-4 py-3 text-[11px] font-extrabold uppercase tracking-[0.1em] text-white transition hover:border-[#ffb7c5]/40 hover:text-[#ffb7c5] cursor-pointer"
                              >
                                {t("Extend", "ПРОДЛИТЬ")}
                              </a>
                              <button
                                type="button"
                                onClick={() => setIsPromoModalOpen(true)}
                                className="inline-flex items-center gap-1.5 rounded-[18px] border border-[#3a222c] bg-[#140d11] px-4 py-3 text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#ffb7c5] transition hover:border-[#ffb7c5] hover:text-white cursor-pointer"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="4" width="18" height="16" rx="3"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="7" y1="8" x2="11" y2="8"/></svg>
                                <span>{t("Promo Code", "ПРОМОКОД")}</span>
                              </button>
                            </>
                          )}
                        </>
                      )
                    ) : (
                      <>
                        <a
                          href={FUNPAY_SUBSCRIPTION_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={handleFunPayLinkClick}
                          className="inline-flex items-center justify-center rounded-[18px] bg-[#ff2d75] px-5 py-3 text-[11px] font-black uppercase tracking-[0.12em] text-white shadow-[0_0_26px_rgba(255,45,117,0.4)] transition hover:bg-[#ff4887] hover:scale-102 cursor-pointer"
                        >
                          {t("Buy Subscription", "КУПИТЬ ПОДПИСКУ")}
                        </a>
                        {!hasAlreadyClaimedTrial && (
                          <button
                            type="button"
                            onClick={handleClaimTrial}
                            disabled={isClaimingTrial}
                            className="inline-flex items-center justify-center rounded-[18px] border border-[#281920] bg-[#140d11] px-4 py-3 text-[11px] font-extrabold uppercase tracking-[0.1em] text-white transition hover:border-[#ffb7c5]/40 hover:text-[#ffb7c5] cursor-pointer disabled:opacity-50"
                          >
                            {isClaimingTrial ? t("Activating...", "АКТИВАЦИЯ...") : t("7 Days Trial", "ТЕСТ НА 7 ДНЕЙ")}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setIsPromoModalOpen(true)}
                          className="inline-flex items-center gap-1.5 rounded-[18px] border border-[#3a222c] bg-[#140d11] px-4 py-3 text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#ffb7c5] transition hover:border-[#ffb7c5] hover:text-white cursor-pointer"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="4" width="18" height="16" rx="3"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="7" y1="8" x2="11" y2="8"/></svg>
                          <span>{t("Promo Code", "ПРОМОКОД")}</span>
                        </button>
                      </>
                    )}
                  </div>

                  {freezeSuccessMessage && (
                    <p className="mt-3 text-xs text-[#8ce5b2] flex items-center gap-1.5 font-medium">
                      <span>✓</span> {freezeSuccessMessage}
                    </p>
                  )}
                  {freezeErrorMessage && (
                    <p className="mt-3 text-xs text-[#ff9aa9] flex items-center gap-1.5 font-medium">
                      <span>⚠</span> {freezeErrorMessage}
                    </p>
                  )}
                </div>

                {/* Card 2: Compact System & HWID Specs */}
                <div className="flex flex-col justify-between rounded-[30px] border border-[#201517] bg-[#0d0a0d] p-5 sm:p-6 shadow-[0_0_60px_rgba(255,183,197,0.04)]">
                  <div>
                    <div className="flex items-center justify-between mb-3.5">
                      <span className="font-mono text-[10px] font-extrabold uppercase tracking-[0.28em] text-[#ffc2cf]">
                        {t("System & HWID", "СИСТЕМА & HWID")}
                      </span>
                      {hasActiveSubscriptionRole || hasLifetimeRole ? (
                        <span className="font-mono text-[10px] font-bold text-[#8ce5b2] tracking-[0.1em]">
                          UNDETECTED
                        </span>
                      ) : (
                        <span className="font-mono text-[10px] font-bold text-[#8a7882] tracking-[0.1em]">
                          {t("Awaiting", "ОЖИДАНИЕ")}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between rounded-xl border border-[#22141a] bg-[#120b0e] px-3 py-2 text-xs">
                        <span className="text-[#8c7a84]">{t("HWID Binding", "HWID привязка")}</span>
                        {hasActiveSubscriptionRole || hasLifetimeRole ? (
                          <span className="font-mono text-[11px] font-bold text-[#8ce5b2]">
                            {profileHwid ? t("Active", "АКТИВНА") : t("Active", "АКТИВНА")}
                          </span>
                        ) : (
                          <span className="font-mono text-[11px] font-bold text-[#6d5b65]">
                            {t("Inactive", "НЕАКТИВНА")}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between rounded-xl border border-[#22141a] bg-[#120b0e] px-3 py-2 text-xs">
                        <span className="text-[#8c7a84]">{t("Anticheat Status", "Статус античита")}</span>
                        <span className="font-mono text-[11px] font-bold text-[#8ce5b2]">
                          VAC SAFE
                        </span>
                      </div>

                      <div className="flex items-center justify-between rounded-xl border border-[#22141a] bg-[#120b0e] px-3 py-2 text-xs">
                        <span className="text-[#8c7a84]">{t("HWID Reset", "Сброс HWID")}</span>
                        {hasActiveSubscriptionRole || hasLifetimeRole ? (
                          <button
                            type="button"
                            onClick={() => setHwidResetSent(true)}
                            className="font-mono text-[11px] font-bold text-[#ffb7c5] underline cursor-pointer hover:text-white transition"
                          >
                            {hwidResetSent ? t("Request Sent", "Запрос отправлен") : t("Request Reset", "Запросить сброс")}
                          </button>
                        ) : (
                          <span className="font-mono text-[11px] font-bold text-[#6d5b65]">
                            {t("Unavailable", "Недоступно")}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between rounded-xl border border-[#22141a] bg-[#120b0e] px-3 py-2 text-xs">
                        <span className="text-[#8c7a84]">{t("Client Version", "Версия клиента")}</span>
                        <span className="font-mono text-[11px] font-bold text-white">
                          v3.2.0 (Stable)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3.5 text-center text-[10px] text-[#6d5b65] leading-snug">
                    {hasActiveSubscriptionRole || hasLifetimeRole
                      ? t("All server components operational", "Все серверные компоненты работают штатно")
                      : t("Subscribe to activate HWID and download client", "Для активации HWID и загрузки чита оформите подписку")}
                  </div>
                </div>
              </div>
            ) : null}

            {/* Horizontal Music Card: Only for Authorized Profiles (UID 2 Egoiste & UID 3 Absolute) */}
            {!isOwner && isMusicAllowedForProfile ? (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-[28px] border border-[#201517] bg-[radial-gradient(circle_at_top_left,rgba(255,183,197,0.08),transparent_60%),#0d0a0d] p-5 sm:px-7 sm:py-5 shadow-[0_0_60px_rgba(255,183,197,0.04)]">
                <div>
                  <div className="flex items-center gap-3 mb-1.5">
                    <span className="font-mono text-[10px] font-extrabold uppercase tracking-[0.28em] text-[#ffc2cf]">
                      {t("Profile Audio Theme", "АУДИО-ТЕМА ПРОФИЛЯ")}
                    </span>
                    <span className={`inline-flex items-center justify-center h-5 rounded-full px-2.5 text-[9px] font-extrabold uppercase tracking-[0.14em] ${
                      profileThemeIsPlaying
                        ? "border border-[#1f5038] bg-[#0c1812] text-[#8ce5b2]"
                        : "border border-[#38232b] bg-[#140d11] text-[#9d858f]"
                    }`}>
                      {profileThemeIsPlaying ? t("Playing", "ИГРАЕТ") : t("Paused", "ПАУЗА")}
                    </span>
                  </div>
                  <div className="text-base sm:text-lg font-black uppercase tracking-tight text-white">
                    {profileThemeTitle || (profileThemeProfileId === 2 ? "FACE — FOREVER YOUNG" : "Cyberpunk Track")}
                  </div>
                  <div className="text-xs text-[#8f7a85] mt-0.5">
                    {t(`Custom soundtrack for ${primaryName} (UID ${profileThemeProfileId})`, `Индивидуальный саундтрек профиля ${primaryName} (UID ${profileThemeProfileId})`)}
                  </div>
                </div>

                <div className="flex items-center gap-4 flex-wrap self-end sm:self-center">
                  <div className="flex items-center gap-3">
                    {/* Animated Equalizer Bars */}
                    <div className="flex items-end gap-[3px] h-6 py-0.5">
                      <span className={`w-[3px] rounded-full bg-[#ffb7c5] transition-all duration-300 ${profileThemeIsPlaying ? "h-3 animate-pulse" : "h-1.5 opacity-50"}`} />
                      <span className={`w-[3px] rounded-full bg-[#ffb7c5] transition-all duration-300 ${profileThemeIsPlaying ? "h-5 animate-pulse" : "h-1.5 opacity-50"}`} />
                      <span className={`w-[3px] rounded-full bg-[#ffb7c5] transition-all duration-300 ${profileThemeIsPlaying ? "h-2.5 animate-pulse" : "h-1.5 opacity-50"}`} />
                      <span className={`w-[3px] rounded-full bg-[#ffb7c5] transition-all duration-300 ${profileThemeIsPlaying ? "h-6 animate-pulse" : "h-1.5 opacity-50"}`} />
                      <span className={`w-[3px] rounded-full bg-[#ffb7c5] transition-all duration-300 ${profileThemeIsPlaying ? "h-4 animate-pulse" : "h-1.5 opacity-50"}`} />
                    </div>
                    <div className="font-mono text-[11px] text-[#ffb7c5] tracking-[0.1em]">
                      <span>{formatAudioClock(profileThemeDisplayedCurrentTime)}</span> / <span>{formatAudioClock(profileThemeDisplayedDuration)}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleProfileThemeToggle}
                    className="inline-flex items-center gap-2 rounded-2xl bg-[#ff2d75] px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.1em] text-white shadow-[0_0_20px_rgba(255,45,117,0.4)] transition hover:bg-[#ff4887] cursor-pointer"
                  >
                    {profileThemeIsPlaying ? (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                        <span>{t("Pause", "ПАУЗА")}</span>
                      </>
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        <span>{t("Play", "ИГРАТЬ")}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : null}

              <div className="rounded-[32px] border border-[#201517] bg-[#0d0d0d] px-7 py-7 shadow-[0_0_60px_rgba(255,183,197,0.06)]">
                <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-[#ffb7c5]">{t("Profile Comments", "Комментарии профиля")}</p>
                {visibleCurrentUser && !isCurrentAccountBanned && !isCurrentAccountVerificationLocked ? (
                  <form onSubmit={handleCommentSubmit} className="mt-5">
                    <label className="block">
                      <textarea
                        ref={commentTextareaRef}
                        value={commentInput}
                        maxLength={280}
                        rows={1}
                        onChange={(event) => handleMentionComposerChange("new", event)}
                        onInput={(event) => {
                          syncTextareaHeight(event.currentTarget);
                          handleMentionComposerInteraction("new", event.currentTarget);
                        }}
                        onClick={(event) => handleMentionComposerInteraction("new", event.currentTarget)}
                        onSelect={(event) => handleMentionComposerInteraction("new", event.currentTarget)}
                        onFocus={(event) => handleMentionComposerInteraction("new", event.currentTarget)}
                        onBlur={handleMentionComposerBlur}
                        className="w-full resize-none overflow-hidden rounded-2xl border border-[#232323] bg-[#090909] px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-[#ffb7c5]/55"
                        placeholder={t(
                          `Write something for ${primaryName}...`,
                          `Напишите что-нибудь для ${primaryName}...`
                        )}
                      />
                    </label>
                    {renderMentionSuggestions("new")}
                    {renderComposerMentionAttachments("new", commentInput, commentDraftMentionProfilesByKey)}
                    <input ref={commentMediaInputRef} type="file" accept={COMMENT_MEDIA_FILE_ACCEPT} onChange={handleCommentMediaChange} className="hidden" />
                    {commentMediaPreviewUrl ? <div className="mt-3 overflow-hidden rounded-[22px] border border-[#232323] bg-[#050505]">
                      <CommentMediaFrame src={commentMediaPreviewUrl} mediaType={commentMediaFile?.type ?? null} alt="Selected comment media preview" className="block max-h-[320px] w-full object-contain" />
                    </div> : null}
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <button type="submit" disabled={isCommentSubmitting || (!commentInput.trim() && !commentMediaFile)} className="inline-flex items-center justify-center rounded-full border border-[#ffb7c5]/30 bg-[#ffb7c5] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-black transition hover:bg-[#ffc8d3] disabled:cursor-not-allowed disabled:opacity-60">{isCommentSubmitting ? "Posting..." : "Post"}</button>
                        <button type="button" onClick={() => commentMediaInputRef.current?.click()} className="inline-flex items-center justify-center rounded-full border border-[#3a2a31] bg-[#140d11] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#ffb7c5] transition hover:border-[#ffb7c5]/40 hover:text-white">
                          Media
                        </button>
                        {commentMediaFile ? <button type="button" onClick={clearCommentMediaSelection} className="inline-flex items-center justify-center rounded-full border border-[#2a2a2a] bg-[#101010] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-gray-300 transition hover:border-[#4a4a4a] hover:text-white">Remove</button> : null}
                      </div>
                      <span className="text-xs text-gray-500">{commentInput.trim().length}/280</span>
                    </div>
                    {commentError ? <p className="mt-3 text-xs leading-relaxed text-[#ff9aa9]">{commentError}</p> : null}
                    {commentSuccess ? <p className="mt-3 text-xs leading-relaxed text-[#8ce5b2]">{commentSuccess}</p> : null}
                  </form>
                ) : visibleCurrentUser && isCurrentAccountBanned ? (
                  <div className="mt-5 rounded-[24px] border border-red-400/20 bg-red-500/10 px-4 py-4">
                    <p className="text-sm leading-relaxed text-red-100/85">This account has been banned by an administrator. Posting and profile actions are disabled.</p>
                  </div>
                ) : visibleCurrentUser && isCurrentAccountVerificationLocked ? (
                  <div className="mt-5 rounded-[24px] border border-[#4d3024] bg-[linear-gradient(180deg,#1a110d_0%,#120d0a_100%)] px-4 py-4">
                    <p className="text-sm leading-relaxed text-[#f3d2c5]">Verify your email to open the profile and use comments.</p>
                  </div>
                ) : (
                  <div className="mt-5 rounded-[24px] border border-[#1d1d1d] bg-[#090909] px-4 py-4">
                    <p className="text-sm leading-relaxed text-gray-400">Sign in to leave a comment on this profile. Guests can read comments, but cannot post.</p>
                  </div>
                )}

                <div className="mt-6">
                  <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-gray-500">Recent Messages</p>
                  {isCommentsLoading ? <p className="mt-4 text-sm text-gray-500">Loading comments...</p> : null}
                  {!isCommentsLoading && commentsError ? <p className="mt-4 text-sm leading-relaxed text-[#ff9aa9]">{commentsError}</p> : null}
                  {!isCommentsLoading && !commentsError && !comments.length ? <p className="mt-4 text-sm text-gray-500">{t("No comments yet.", "Пока нет комментариев.")}</p> : null}
                  {!isCommentsLoading && !commentsError && comments.length ? <div className="mt-4 flex flex-col gap-3">
                    {comments.map((comment, commentIndex) => {
                      const isDeletingComment = deletingCommentId === comment.id;
                      const isConfirmingCommentDelete = confirmingCommentDeleteId === comment.id;
                      const isEditingComment = editingCommentId === comment.id;
                      const isSavingCommentUpdate = isEditingComment && isCommentUpdating;
                      const isPendingComment = comment.pending === true;
                      const showEditAction = !isPendingComment && canEditComment(comment);
                      const showDeleteAction = !isPendingComment && canDeleteComment(comment);
                      const isCommentActionsMenuOpen = openCommentActionsMenuId === comment.id;
                      const canShowCommentActionsMenu =
                        isConfirmingCommentDelete ||
                        showDeleteAction ||
                        (showEditAction && !isEditingComment);
                      const isCommentActionMenuBusy = isDeletingComment || isSavingCommentUpdate;
                      const commentInitials = initialsFromText(comment.authorName);
                      const resolvedCommentAuthorProfile = resolveCommentAuthorProfile(comment);
                      const resolvedCommentAuthorRole = resolveCommentAuthorRole(comment);
                      const resolvedCommentAuthorPhotoURL = resolveCommentAuthorPhotoURL(comment);
                      const resolvedCommentMediaURL = resolveCommentMediaUrl(comment);
                      const resolvedCommentMediaDisplayURL = resolveCommentMediaDisplayUrl(comment);
                      const hasCommentMediaMetadata = Boolean(
                        (typeof comment.mediaPath === "string" && comment.mediaPath.trim()) ||
                          (typeof comment.mediaURL === "string" && comment.mediaURL.trim()) ||
                          (typeof comment.mediaType === "string" && comment.mediaType.trim()) ||
                          (typeof comment.mediaSize === "number" &&
                            Number.isFinite(comment.mediaSize) &&
                            comment.mediaSize > 0)
                      );
                      const isCommentAttachmentUnavailable =
                        hasCommentMediaMetadata && !resolvedCommentMediaURL;
                      const commentAuthorStyle = roleCommentAuthorStyle(resolvedCommentAuthorRole);
                      const isCommentEdited = Boolean(comment.updatedAt);
                      const commentEditedBadgeText = getCommentEditedBadgeText(comment);
                      const commentDisplayTimestamp =
                        isCommentEdited && comment.updatedAt
                          ? comment.updatedAt
                          : comment.createdAt;

                      return <div key={comment.id} className="rounded-[24px] border border-[#1d1d1d] bg-[#090909] px-4 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="group/comment-profile relative flex min-w-0 items-start gap-3">
                            {resolvedCommentAuthorPhotoURL ? <AvatarMedia src={resolvedCommentAuthorPhotoURL} alt={comment.authorName} loading={commentIndex < 4 ? "eager" : "lazy"} decoding="async" className="h-11 w-11 shrink-0 rounded-2xl border border-[#2a2022] object-cover shadow-[0_0_18px_rgba(255,183,197,0.1)]" /> : <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#2a2022] bg-[#1a1012] text-[11px] font-black uppercase text-[#ffb7c5] shadow-[0_0_18px_rgba(255,183,197,0.08)]">{commentInitials}</div>}
                            <div className="min-w-0">
                              <div className="flex min-w-0 items-center gap-2">
                                {comment.authorProfileId ? <a href={profilePath(comment.authorProfileId)} style={commentAuthorStyle} className="min-w-0 truncate text-sm font-semibold transition hover:text-white">{comment.authorName}</a> : <p style={commentAuthorStyle} className="min-w-0 truncate text-sm font-semibold">{comment.authorName}</p>}
                                {!isConfirmingCommentDelete && isPendingComment ? <span className="shrink-0 text-[10px] font-mono uppercase tracking-[0.16em] text-[#ffb7c5]">Sending...</span> : null}
                                {!isConfirmingCommentDelete && commentEditedBadgeText ? <span className="shrink-0 text-[10px] font-mono uppercase tracking-[0.16em] text-gray-500">{commentEditedBadgeText}</span> : null}
                              </div>
                              {!isConfirmingCommentDelete ? <p className="mt-1 text-xs text-gray-500">{formatTime(commentDisplayTimestamp, locale)}</p> : null}
                            </div>
                            {resolvedCommentAuthorProfile ? renderProfileHoverPreview(resolvedCommentAuthorProfile, comment.authorName, "start") : null}
                          </div>
                          <div className="-mt-1 flex shrink-0 items-start justify-end">
                            {canShowCommentActionsMenu ? <div data-comment-actions-menu className="relative">
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenCommentActionsMenuId((currentId) =>
                                    currentId === comment.id ? null : comment.id
                                  );
                                  if (!isConfirmingCommentDelete) {
                                    setConfirmingCommentDeleteId((currentId) =>
                                      currentId === comment.id ? currentId : null
                                    );
                                  }
                                }}
                                aria-label={isCommentActionsMenuOpen ? "Close comment actions" : "Open comment actions"}
                                aria-expanded={isCommentActionsMenuOpen}
                                disabled={isCommentActionMenuBusy}
                                className={`inline-flex h-6 w-6 items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                  isCommentActionsMenuOpen
                                    ? "bg-transparent text-[#ffb7c5]"
                                    : "bg-transparent text-[#b78a95] hover:text-[#ffb7c5]"
                                }`}
                              >
                                <span className="inline-flex items-center gap-0.5">
                                  <span className="h-1 w-1 rounded-full bg-current" />
                                  <span className="h-1 w-1 rounded-full bg-current" />
                                  <span className="h-1 w-1 rounded-full bg-current" />
                                </span>
                              </button>
                              {isCommentActionsMenuOpen ? <div className="absolute right-0 top-0 z-20 translate-x-[calc(100%+20px)] p-0 max-[900px]:right-0 max-[900px]:top-full max-[900px]:mt-2 max-[900px]:translate-x-0">
                                <div className="flex min-w-[124px] flex-col gap-1.5">
                                  {isConfirmingCommentDelete ? <>
                                    <button type="button" onClick={() => handleCommentDelete(comment.id)} disabled={isDeletingComment || isSavingCommentUpdate} className="inline-flex items-center justify-center rounded-full border border-[#ffb7c5]/30 bg-[#ffb7c5] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-black transition hover:bg-[#ffc8d3] disabled:cursor-not-allowed disabled:opacity-60">{isDeletingComment ? "Deleting..." : "Yes"}</button>
                                    <button type="button" onClick={() => cancelCommentDeleteConfirmation(comment.id)} disabled={isDeletingComment} className="inline-flex items-center justify-center rounded-full border border-[#3a2a31] bg-[#140d11] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#ffb7c5] transition hover:border-[#ffb7c5]/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-60">No</button>
                                  </> : <>
                                    {showEditAction && !isEditingComment ? <button type="button" onClick={() => handleCommentEditStart(comment)} disabled={isDeletingComment || isCommentUpdating} className="inline-flex items-center justify-center rounded-full border border-[#3a2a31] bg-[#140d11] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#ffb7c5] transition hover:border-[#ffb7c5]/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-60">Edit</button> : null}
                                    {showDeleteAction ? <button type="button" onClick={() => requestCommentDeleteConfirmation(comment.id)} disabled={isDeletingComment || isSavingCommentUpdate} className="inline-flex items-center justify-center rounded-full border border-[#3a2a31] bg-[#140d11] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#ffb7c5] transition hover:border-[#ffb7c5]/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-60">Delete</button> : null}
                                  </>}
                                </div>
                              </div> : null}
                            </div> : null}
                          </div>
                        </div>
                        {isConfirmingCommentDelete ? null : isEditingComment ? <div className="mt-3">
                          <textarea
                            ref={editingCommentTextareaRef}
                            value={editingCommentMessage}
                            maxLength={280}
                            rows={3}
                            onChange={(event) => handleMentionComposerChange("edit", event)}
                            onInput={(event) => {
                              syncTextareaHeight(event.currentTarget);
                              handleMentionComposerInteraction("edit", event.currentTarget);
                            }}
                            onClick={(event) => handleMentionComposerInteraction("edit", event.currentTarget)}
                            onSelect={(event) => handleMentionComposerInteraction("edit", event.currentTarget)}
                            onFocus={(event) => handleMentionComposerInteraction("edit", event.currentTarget)}
                            onBlur={handleMentionComposerBlur}
                            className="w-full resize-none overflow-hidden rounded-2xl border border-[#232323] bg-[#090909] px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-[#ffb7c5]/55"
                            placeholder="Update comment..."
                          />
                          {renderMentionSuggestions("edit")}
                          {renderComposerMentionAttachments("edit", editingCommentMessage, editingDraftMentionProfilesByKey)}
                          <input ref={editingCommentMediaInputRef} type="file" accept={COMMENT_MEDIA_FILE_ACCEPT} onChange={handleEditingCommentMediaChange} className="hidden" />
                          {editingCommentMediaPreviewUrl ? <div className="mt-3 overflow-hidden rounded-[22px] border border-[#232323] bg-[#050505]">
                            <CommentMediaFrame src={editingCommentMediaPreviewUrl} mediaType={editingCommentMediaFile?.type ?? null} alt="Updated comment media preview" className="block max-h-[320px] w-full object-contain" />
                          </div> : null}
                          {!editingCommentMediaPreviewUrl && !isEditingCommentMediaRemoved && resolvedCommentMediaURL ? <div className="mt-3 overflow-hidden rounded-[22px] border border-[#232323] bg-[#050505]">
                            <CommentMediaFrame src={resolvedCommentMediaDisplayURL ?? resolvedCommentMediaURL} mediaType={comment.mediaType} alt={`${comment.authorName} comment attachment`} className="block max-h-[320px] w-full object-contain" controls={isCommentVideoMediaType(comment.mediaType)} />
                          </div> : null}
                          {!editingCommentMediaPreviewUrl && !isEditingCommentMediaRemoved && isCommentAttachmentUnavailable ? <div className="mt-3 rounded-[18px] border border-[#4d3024] bg-[linear-gradient(180deg,#1a110d_0%,#120d0a_100%)] px-3 py-2">
                            <p className="text-xs leading-relaxed text-[#f3d2c5]">Attachment unavailable. Re-upload media to restore this comment attachment.</p>
                          </div> : null}
                          {editingCommentMediaFile ? <div className="mt-3 flex items-center">
                            <button type="button" onClick={clearEditingCommentMediaSelection} disabled={isSavingCommentUpdate} className="inline-flex items-center justify-center rounded-full border border-[#2a2a2a] bg-[#101010] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-gray-300 transition hover:border-[#4a4a4a] hover:text-white disabled:cursor-not-allowed disabled:opacity-60">Remove</button>
                          </div> : null}
                          {!editingCommentMediaFile && resolvedCommentMediaURL && !isEditingCommentMediaRemoved ? <div className="mt-3 flex items-center">
                            <button type="button" onClick={removeEditingCommentMedia} disabled={isSavingCommentUpdate} className="inline-flex items-center justify-center rounded-full border border-[#2a2a2a] bg-[#101010] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-gray-300 transition hover:border-[#4a4a4a] hover:text-white disabled:cursor-not-allowed disabled:opacity-60">Remove</button>
                          </div> : null}
                          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-3">
                              <button type="button" onClick={() => handleCommentUpdate(comment.id)} disabled={isSavingCommentUpdate || (!editingCommentMessage.trim() && !editingCommentMediaFile && !(resolvedCommentMediaURL && !isEditingCommentMediaRemoved))} className="inline-flex items-center justify-center rounded-full border border-[#ffb7c5]/30 bg-[#ffb7c5] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-black transition hover:bg-[#ffc8d3] disabled:cursor-not-allowed disabled:opacity-60">{isSavingCommentUpdate ? "Saving..." : "Save"}</button>
                              <button type="button" onClick={() => editingCommentMediaInputRef.current?.click()} disabled={isSavingCommentUpdate} className="inline-flex items-center justify-center rounded-full border border-[#3a2a31] bg-[#140d11] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#ffb7c5] transition hover:border-[#ffb7c5]/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-60">Media</button>
                              <button type="button" onClick={handleCommentEditCancel} disabled={isSavingCommentUpdate} className="inline-flex items-center justify-center rounded-full border border-[#3a2a31] bg-[#140d11] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#ffb7c5] transition hover:border-[#ffb7c5]/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-60">Cancel</button>
                            </div>
                            <span className="text-xs text-gray-500">{editingCommentMessage.trim().length}/280</span>
                          </div>
                        </div> : <div className="mt-3 space-y-3">
                          {comment.message ? <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-300">{renderCommentMessageWithMentions(comment.message)}</p> : null}
                          {resolvedCommentMediaURL ? <div className="overflow-hidden rounded-[22px] border border-[#232323] bg-[#050505]">
                            <CommentMediaFrame src={resolvedCommentMediaDisplayURL ?? resolvedCommentMediaURL} mediaType={comment.mediaType} alt={`${comment.authorName} comment attachment`} className="block max-h-[360px] w-full object-contain" controls={isCommentVideoMediaType(comment.mediaType)} />
                          </div> : null}
                          {isCommentAttachmentUnavailable ? <div className="rounded-[18px] border border-[#4d3024] bg-[linear-gradient(180deg,#1a110d_0%,#120d0a_100%)] px-3 py-2">
                            <p className="text-xs leading-relaxed text-[#f3d2c5]">Attachment unavailable.</p>
                          </div> : null}
                        </div>}
                      </div>;
                    })}
                  </div> : null}
                </div>
              </div>

              {/* User Self-Edit Profile Modal */}
              {isClientMounted && isEditProfileModalOpen && isOwner && activeProfile && typeof document !== "undefined"
                ? createPortal(
                    <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
                      <div
                        className="absolute inset-0 bg-black/80 backdrop-blur-md"
                        onClick={() => setIsEditProfileModalOpen(false)}
                      />
                      <div className="relative w-full max-w-xl overflow-hidden rounded-[32px] border border-[#ffb7c5]/35 bg-[#0c070a] shadow-[0_0_80px_rgba(255,183,197,0.2)]">
                        {/* Modal Header */}
                        <div className="border-b border-[#24151b] bg-[radial-gradient(circle_at_top,rgba(255,183,197,0.18),transparent_65%)] px-6 py-5">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <h2 className="text-base font-bold text-white">
                                {t("Edit Profile", "Редактирование профиля")}
                              </h2>
                              <p className="text-xs text-gray-400">
                                {primaryName} · @{activeProfile.login || "user"} · UID #{activeProfile.profileId}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setIsEditProfileModalOpen(false)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#311c24] bg-[#140b0f] text-gray-400 hover:border-[#ffb7c5]/50 hover:text-white transition"
                            >
                              ✕
                            </button>
                          </div>

                          {/* Tabs Bar */}
                          <div className="mt-4 flex flex-wrap gap-1.5 border-t border-[#1f1217] pt-3">
                            {[
                              { id: "general", label: t("General", "Основное") },
                              { id: "avatar", label: t("Avatar", "Аватар") },
                              { id: "banner", label: t("Banner", "Баннер") },
                              { id: "security", label: t("Security", "Безопасность") },
                            ].map((tab) => (
                              <button
                                key={tab.id}
                                type="button"
                                onClick={() => setEditProfileActiveTab(tab.id as any)}
                                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                                  editProfileActiveTab === tab.id
                                    ? "bg-[#ffb7c5] text-black shadow-[0_0_14px_rgba(255,183,197,0.3)]"
                                    : "border border-[#23141a] bg-[#10090c] text-gray-400 hover:text-white"
                                }`}
                              >
                                <span>{tab.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                    {/* Modal Body */}
                    <div className="max-h-[70vh] overflow-y-auto px-6 py-5 space-y-4">
                      {/* Tab 1: General */}
                      {editProfileActiveTab === "general" && (() => {
                        const displayNameCooldown = isOwner
                          ? getProfileFieldCooldown(activeProfile?.displayNameUpdatedAt)
                          : { isLocked: false, daysLeft: 0, unlockDate: null };
                        const loginCooldown = isOwner
                          ? getProfileFieldCooldown(activeProfile?.loginUpdatedAt)
                          : { isLocked: false, daysLeft: 0, unlockDate: null };

                        return (
                          <div className="space-y-4">
                            <div className="rounded-2xl border border-[#23141a] bg-[#10090c] p-4">
                              <label className="block">
                                <div className="mb-1.5 flex items-center justify-between">
                                  <span className="block text-xs font-mono uppercase tracking-[0.16em] text-gray-400">
                                    {t("Displayed Name (Nickname)", "Отображаемое имя (Никнейм)")}
                                  </span>
                                  {displayNameCooldown.isLocked && (
                                    <span className="text-[11px] font-mono text-[#f97316]">
                                      {t(`in ${displayNameCooldown.daysLeft} d.`, `через ${displayNameCooldown.daysLeft} дн.`)}
                                    </span>
                                  )}
                                </div>
                                <input
                                  type="text"
                                  value={displayNameInput}
                                  maxLength={48}
                                  disabled={isDisplayNameSaving || displayNameCooldown.isLocked}
                                  autoComplete="nickname"
                                  onChange={(e) => {
                                    setDisplayNameInput(e.target.value);
                                    setDisplayNameError(null);
                                    setDisplayNameSuccess(null);
                                  }}
                                  className={`w-full rounded-xl border bg-[#080507] px-4 py-2.5 text-sm text-white outline-none transition ${
                                    displayNameCooldown.isLocked
                                      ? "border-[#25181e] text-gray-400 cursor-not-allowed opacity-75"
                                      : "border-[#2b1820] focus:border-[#ffb7c5]"
                                  }`}
                                  placeholder="Absolute"
                                />
                              </label>
                              <p className="mt-1.5 text-[11px]">
                                {displayNameCooldown.isLocked ? (
                                  <span className="text-[#f97316]">
                                    {t(
                                      `Nickname can be changed only once a month (30 days). Available in ${displayNameCooldown.daysLeft} d.`,
                                      `Никнейм можно изменять только 1 раз в месяц (30 дней). Доступно через ${displayNameCooldown.daysLeft} дн.`
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-gray-500">
                                    {t(
                                      "Displayed at the top of your profile. Can be changed once a month (30 days).",
                                      "Отображается вверху вашего профиля. Изменять можно 1 раз в месяц (30 дней)."
                                    )}
                                  </span>
                                )}
                              </p>
                              <div className="mt-3 flex items-center justify-between gap-3">
                                <button
                                  type="button"
                                  onClick={handleDisplayNameSave}
                                  disabled={
                                    isDisplayNameSaving ||
                                    displayNameCooldown.isLocked ||
                                    displayNameInput.trim() === (activeProfile?.displayName || "").trim()
                                  }
                                  className="rounded-full border border-[#ffb7c5]/40 bg-[#ffb7c5] px-4 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-black transition hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  {isDisplayNameSaving
                                    ? t("Saving...", "Сохранение...")
                                    : displayNameCooldown.isLocked
                                    ? t("Locked (30 days)", "Недоступно (30 дн.)")
                                    : t("Save Name", "Сохранить имя")}
                                </button>
                                {displayNameSuccess && (
                                  <span className="text-xs text-[#8ce5b2] font-medium">✓ {displayNameSuccess}</span>
                                )}
                                {displayNameError && (
                                  <span className="text-xs text-[#ff9aa9] font-medium">⚠ {displayNameError}</span>
                                )}
                              </div>
                            </div>

                            <div className="rounded-2xl border border-[#23141a] bg-[#10090c] p-4">
                              <label className="block">
                                <div className="mb-1.5 flex items-center justify-between">
                                  <span className="block text-xs font-mono uppercase tracking-[0.16em] text-gray-400">
                                    {t("Sign-in Login", "Логин для входа")}
                                  </span>
                                  {loginCooldown.isLocked && (
                                    <span className="text-[11px] font-mono text-[#f97316]">
                                      {t(`in ${loginCooldown.daysLeft} d.`, `через ${loginCooldown.daysLeft} дн.`)}
                                    </span>
                                  )}
                                </div>
                                <input
                                  ref={ownerUsernameInputRef}
                                  type="text"
                                  value={usernameInput}
                                  minLength={3}
                                  maxLength={24}
                                  disabled={isUsernameSaving || loginCooldown.isLocked}
                                  autoComplete="username"
                                  onChange={(e) => {
                                    setUsernameInput(e.target.value);
                                    setUsernameError(null);
                                    setUsernameSuccess(null);
                                  }}
                                  className={`w-full rounded-xl border bg-[#080507] px-4 py-2.5 text-sm text-white outline-none transition ${
                                    loginCooldown.isLocked
                                      ? "border-[#25181e] text-gray-400 cursor-not-allowed opacity-75"
                                      : "border-[#2b1820] focus:border-[#ffb7c5]"
                                  }`}
                                  placeholder="your_login"
                                />
                              </label>
                              <p className="mt-1.5 text-[11px]">
                                {loginCooldown.isLocked ? (
                                  <span className="text-[#f97316]">
                                    {t(
                                      `Login can be changed only once a month (30 days). Available in ${loginCooldown.daysLeft} d.`,
                                      `Логин можно изменять только 1 раз в месяц (30 дней). Доступно через ${loginCooldown.daysLeft} дн.`
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-gray-500">
                                    {t(
                                      "Letters, numbers, `.`, `_`, and `-`. Can be changed once a month (30 days).",
                                      "Буквы, цифры, `.`, `_` и `-`. Изменять можно 1 раз в месяц (30 дней)."
                                    )}
                                  </span>
                                )}
                              </p>
                              {requiresUsernamePasswordConfirmation && (
                                <div className="mt-3">
                                  <span className="mb-1.5 block text-xs font-mono uppercase tracking-[0.16em] text-gray-400">
                                    {t("Current Password (to confirm)", "Текущий пароль (для подтверждения)")}
                                  </span>
                                  <input
                                    type="password"
                                    value={usernamePasswordInput}
                                    autoComplete="current-password"
                                    disabled={loginCooldown.isLocked}
                                    onChange={(e) => {
                                      setUsernamePasswordInput(e.target.value);
                                      setUsernameError(null);
                                      setUsernameSuccess(null);
                                    }}
                                    className="w-full rounded-xl border border-[#2b1820] bg-[#080507] px-4 py-2.5 text-sm text-white outline-none focus:border-[#ffb7c5] transition disabled:opacity-40"
                                    placeholder={t("Enter current password", "Введите текущий пароль")}
                                  />
                                </div>
                              )}
                              <div className="mt-3 flex items-center justify-between gap-3">
                                <button
                                  type="button"
                                  onClick={handleUsernameSave}
                                  disabled={
                                    isUsernameSaving ||
                                    loginCooldown.isLocked ||
                                    normalizeUsernameDraft(usernameInput) === normalizeUsernameDraft(activeProfile?.login)
                                  }
                                  className="rounded-full border border-[#ffb7c5]/40 bg-[#ffb7c5] px-4 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-black transition hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  {isUsernameSaving
                                    ? t("Saving...", "Сохранение...")
                                    : loginCooldown.isLocked
                                    ? t("Locked (30 days)", "Недоступно (30 дн.)")
                                    : t("Save Login", "Сохранить логин")}
                                </button>
                                {usernameSuccess && (
                                  <span className="text-xs text-[#8ce5b2] font-medium">✓ {usernameSuccess}</span>
                                )}
                                {usernameError && (
                                  <span className="text-xs text-[#ff9aa9] font-medium">⚠ {usernameError}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Tab 2: Avatar */}
                      {editProfileActiveTab === "avatar" && (
                        <div className="rounded-2xl border border-[#23141a] bg-[#10090c] p-5">
                          <div className="flex flex-col sm:flex-row items-center gap-5">
                            <div className="relative shrink-0">
                              {hasActiveProfileAvatar ? (
                                <AvatarMedia
                                  src={activeProfileAvatarUrl ?? ""}
                                  alt={primaryName}
                                  loading="eager"
                                  decoding="async"
                                  className="h-28 w-28 rounded-3xl border border-[#ffb7c5]/30 object-cover shadow-[0_0_30px_rgba(255,183,197,0.2)]"
                                />
                              ) : (
                                <div className="flex h-28 w-28 items-center justify-center rounded-3xl border border-[#ffb7c5]/30 bg-[#1a0e13] text-3xl font-black uppercase text-[#ffb7c5] shadow-[0_0_30px_rgba(255,183,197,0.2)]">
                                  {initials}
                                </div>
                              )}
                            </div>
                            <div className="flex-1 text-center sm:text-left">
                              <p className="text-sm font-bold text-white">
                                {hasActiveProfileAvatar ? t("Custom Avatar", "Пользовательский аватар") : t("Default Avatar", "Стандартный аватар")}
                              </p>
                              <p className="mt-1 text-xs text-gray-400">
                                {t("Supported formats: PNG, JPG, WEBP, GIF (up to 5 MB).", "Поддерживаемые форматы: PNG, JPG, WEBP, GIF (до 5 МБ).")}
                              </p>
                              <div className="mt-4 flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                                <button
                                  type="button"
                                  onClick={() => avatarInputRef.current?.click()}
                                  disabled={isAvatarUploading || isAvatarDeleting}
                                  className="rounded-full border border-[#ffb7c5]/40 bg-[#ffb7c5] px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-black transition hover:bg-white disabled:opacity-50"
                                >
                                  {isAvatarUploading ? t("Uploading...", "Загрузка...") : hasActiveProfileAvatar ? t("Replace Avatar", "Заменить аватар") : t("Upload Avatar", "Загрузить аватар")}
                                </button>
                                {hasActiveProfileAvatar && (
                                  <button
                                    type="button"
                                    onClick={handleAvatarDelete}
                                    disabled={isAvatarUploading || isAvatarDeleting}
                                    className="rounded-full border border-[#ff5a54]/30 bg-[#16080b] px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#ff9aa9] hover:bg-[#ff5a54] hover:text-black transition disabled:opacity-50"
                                  >
                                    {isAvatarDeleting ? t("Deleting...", "Удаление...") : t("Delete", "Удалить")}
                                  </button>
                                )}
                                <input ref={avatarInputRef} type="file" accept={AVATAR_FILE_ACCEPT} onChange={handleAvatarChange} className="hidden" />
                              </div>
                              {avatarSuccess && <p className="mt-2 text-xs text-[#8ce5b2]">✓ {avatarSuccess}</p>}
                              {avatarError && <p className="mt-2 text-xs text-[#ff9aa9]">⚠ {avatarError}</p>}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Tab 3: Banner */}
                      {editProfileActiveTab === "banner" && (
                        <div className="rounded-2xl border border-[#23141a] bg-[#10090c] p-5 space-y-4">
                          <div>
                            <p className="text-sm font-bold text-white">
                              {hasActiveProfileBanner
                                ? t("Custom Profile Banner", "Пользовательский баннер")
                                : t("Default Pattern Banner", "Стандартный баннер")}
                            </p>
                            <p className="mt-1 text-xs text-gray-400">
                              {t(
                                "Recommended size: 1200 × 160 px (or 1400 × 200 px). Supported formats: PNG, JPG, WEBP, GIF (up to 5 MB).",
                                "Рекомендуемый размер: 1200 × 160 px (или 1400 × 200 px). Поддерживаемые форматы: PNG, JPG, WEBP, GIF (до 5 МБ)."
                              )}
                            </p>
                          </div>

                          {/* Live Banner Preview */}
                          <div className="relative aspect-[7.2/1] w-full overflow-hidden rounded-2xl border border-[#2c1c24] bg-[#080507]">
                            {hasActiveProfileBanner ? (
                              <img
                                src={activeProfileBannerUrl ?? ""}
                                alt="Banner Preview"
                                className="h-full w-full object-cover object-center"
                              />
                            ) : (
                              <div
                                className="relative h-full w-full"
                                style={{
                                  background:
                                    "radial-gradient(circle at 20% 50%, rgba(255, 183, 197, 0.16), transparent 50%), radial-gradient(circle at 80% 30%, rgba(255, 51, 119, 0.12), transparent 50%), linear-gradient(180deg, #170d13 0%, #0d0d0d 100%)",
                                }}
                              >
                                <div
                                  className="absolute inset-0"
                                  style={{
                                    backgroundImage:
                                      "radial-gradient(rgba(255, 183, 197, 0.28) 0.8px, transparent 0.8px)",
                                    backgroundSize: "16px 16px",
                                    opacity: 0.35,
                                  }}
                                />
                              </div>
                            )}
                            <div className="absolute bottom-2 left-3 flex items-center gap-2">
                              <span className="rounded-md border border-white/10 bg-black/60 px-2 py-0.5 text-[10px] font-mono text-[#ffb7c5] backdrop-blur-sm">
                                {hasActiveProfileBanner ? t("Custom Banner", "Кастомный") : t("Sakura Pattern", "Узор Sakura")}
                              </span>
                              <span className="text-[10px] font-mono text-gray-400">1200 × 160 px</span>
                            </div>
                          </div>

                          {/* Controls */}
                          <div className="flex flex-wrap items-center gap-2.5 pt-1">
                            <button
                              type="button"
                              onClick={() => bannerInputRef.current?.click()}
                              disabled={isBannerUploading || isBannerDeleting}
                              className="rounded-full border border-[#ffb7c5]/40 bg-[#ffb7c5] px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-black transition hover:bg-white disabled:opacity-50 cursor-pointer"
                            >
                              {isBannerUploading
                                ? t("Uploading...", "Загрузка...")
                                : hasActiveProfileBanner
                                ? t("Replace Banner", "Заменить баннер")
                                : t("Upload Banner", "Загрузить баннер")}
                            </button>
                            {hasActiveProfileBanner && (
                              <button
                                type="button"
                                onClick={handleBannerDelete}
                                disabled={isBannerUploading || isBannerDeleting}
                                className="rounded-full border border-[#ff5a54]/30 bg-[#16080b] px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#ff9aa9] hover:bg-[#ff5a54] hover:text-black transition disabled:opacity-50 cursor-pointer"
                              >
                                {isBannerDeleting
                                  ? t("Deleting...", "Удаление...")
                                  : t("Reset to Default", "Сбросить по умолчанию")}
                              </button>
                            )}
                            <input
                              ref={bannerInputRef}
                              type="file"
                              accept={AVATAR_FILE_ACCEPT}
                              onChange={handleBannerChange}
                              className="hidden"
                            />
                          </div>
                          {bannerSuccess && <p className="mt-2 text-xs text-[#8ce5b2]">✓ {bannerSuccess}</p>}
                          {bannerError && <p className="mt-2 text-xs text-[#ff9aa9]">⚠ {bannerError}</p>}
                        </div>
                      )}

                      {/* Tab 4: Security */}
                      {editProfileActiveTab === "security" && (
                        <div className="space-y-4">
                          {requiresUsernamePasswordConfirmation ? (
                            <div className="rounded-2xl border border-[#23141a] bg-[#10090c] p-4 space-y-3">
                              <p className="text-xs font-mono uppercase tracking-[0.16em] text-gray-400">
                                {t("Change Password", "Смена пароля")}
                              </p>
                              <div>
                                <span className="mb-1 block text-xs text-gray-500">{t("Current Password", "Текущий пароль")}</span>
                                <input
                                  type="password"
                                  value={currentPasswordInput}
                                  autoComplete="current-password"
                                  onChange={(e) => {
                                    setCurrentPasswordInput(e.target.value);
                                    setPasswordError(null);
                                    setPasswordSuccess(null);
                                  }}
                                  className="w-full rounded-xl border border-[#2b1820] bg-[#080507] px-4 py-2 text-xs text-white outline-none focus:border-[#ffb7c5] transition"
                                  placeholder="••••••••"
                                />
                              </div>
                              <div>
                                <span className="mb-1 block text-xs text-gray-500">{t("New Password", "Новый пароль")}</span>
                                <input
                                  type="password"
                                  value={newPasswordInput}
                                  autoComplete="new-password"
                                  onChange={(e) => {
                                    setNewPasswordInput(e.target.value);
                                    setPasswordError(null);
                                    setPasswordSuccess(null);
                                  }}
                                  className="w-full rounded-xl border border-[#2b1820] bg-[#080507] px-4 py-2 text-xs text-white outline-none focus:border-[#ffb7c5] transition"
                                  placeholder={t("Minimum 6 characters", "Минимум 6 символов")}
                                />
                              </div>
                              <div>
                                <span className="mb-1 block text-xs text-gray-500">{t("Confirm New Password", "Подтвердите новый пароль")}</span>
                                <input
                                  type="password"
                                  value={confirmNewPasswordInput}
                                  autoComplete="new-password"
                                  onChange={(e) => {
                                    setConfirmNewPasswordInput(e.target.value);
                                    setPasswordError(null);
                                    setPasswordSuccess(null);
                                  }}
                                  className="w-full rounded-xl border border-[#2b1820] bg-[#080507] px-4 py-2 text-xs text-white outline-none focus:border-[#ffb7c5] transition"
                                  placeholder="••••••••"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={handlePasswordSave}
                                disabled={isPasswordSaving}
                                className="rounded-full border border-[#ffb7c5]/40 bg-[#ffb7c5] px-4 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-black transition hover:bg-white disabled:opacity-50"
                              >
                                {isPasswordSaving ? t("Saving...", "Сохранение...") : t("Update Password", "Обновить пароль")}
                              </button>
                              {passwordSuccess && <p className="text-xs text-[#8ce5b2]">✓ {passwordSuccess}</p>}
                              {passwordError && <p className="text-xs text-[#ff9aa9]">⚠ {passwordError}</p>}
                            </div>
                          ) : null}

                          <div className="rounded-2xl border border-[#23141a] bg-[#10090c] p-4">
                            <p className="text-xs font-mono uppercase tracking-[0.16em] text-gray-400 mb-1.5">
                              {t("Password Recovery", "Восстановление пароля")}
                            </p>
                            <p className="text-xs text-gray-400 mb-3">
                              {t("Send a password reset link to your linked email address.", "Отправить ссылку для сброса пароля на привязанную почту.")}
                            </p>
                            <button
                              type="button"
                              onClick={handlePasswordResetRequest}
                              disabled={isPasswordResetSending || !activeProfile.email}
                              className="rounded-full border border-[#3a2029] bg-[#170e13] px-4 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-[#ffb7c5] hover:border-[#ffb7c5] transition disabled:opacity-50"
                            >
                              {isPasswordResetSending ? t("Sending...", "Отправка...") : t("Send Reset Email", "Отправить письмо сброса")}
                            </button>
                          </div>

                          {shouldShowVerificationBanner && (
                            <div className="rounded-2xl border border-[#4d2516] bg-[#170c08] p-4">
                              <p className="text-xs font-mono uppercase tracking-[0.16em] text-[#f97316] mb-1.5">
                                {t("Email Verification", "Подтверждение почты")}
                              </p>
                              <p className="text-xs text-gray-300 mb-3">
                                {t("Verify your email to unlock all profile actions.", "Подтвердите почту для полного доступа к функциям.")}
                              </p>
                              <button
                                type="button"
                                onClick={handleResendVerification}
                                disabled={isVerificationSending}
                                className="rounded-full border border-[#f97316]/40 bg-[#f97316] px-4 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-black transition hover:bg-white disabled:opacity-50"
                              >
                                {isVerificationSending ? t("Sending...", "Отправка...") : t("Resend Email", "Отправить повторно")}
                              </button>
                              {verificationSuccess && <p className="mt-2 text-xs text-[#8ce5b2]">✓ {verificationSuccess}</p>}
                              {verificationError && <p className="mt-2 text-xs text-[#ff9aa9]">⚠ {verificationError}</p>}
                            </div>
                          )}

                          {canOpenAdminPanel && (
                            <div className="rounded-2xl border border-red-950/50 bg-red-950/15 p-4">
                              <p className="text-xs font-mono uppercase tracking-[0.16em] text-red-400 mb-1.5">
                                {t("Danger Zone", "Опасная зона")}
                              </p>
                              <p className="text-xs text-gray-400 mb-3">
                                {t(
                                  "Permanently delete your profile and all associated data. This action cannot be undone.",
                                  "Безвозвратно удалить свой профиль и все связанные данные. Это действие нельзя отменить."
                                )}
                              </p>
                              <button
                                type="button"
                                onClick={handleDeleteAccount}
                                disabled={isAccountDeleting}
                                className="rounded-full border border-red-500/40 bg-red-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-red-300 hover:bg-red-500 hover:text-white transition disabled:opacity-50"
                              >
                                {isAccountDeleting
                                  ? t("Deleting...", "Удаление...")
                                  : t("Delete Account", "Удалить профиль")}
                              </button>
                              {deleteAccountError && (
                                <p className="mt-2 text-xs text-[#ff9aa9]">⚠ {deleteAccountError}</p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>,
                document.body
              )
            : null}

            {/* Promo Code Activation Modal */}
            {isClientMounted && isPromoModalOpen && isOwner && typeof document !== "undefined"
              ? createPortal(
                  <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
                    <div
                      className="absolute inset-0 bg-black/80 backdrop-blur-md"
                      onClick={() => setIsPromoModalOpen(false)}
                    />
                    <div className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-[#24171b] bg-[radial-gradient(circle_at_top_left,rgba(255,183,197,0.12),transparent_60%),#090909] p-6 shadow-[0_0_70px_rgba(0,0,0,0.8)]">
                      <div className="flex items-center justify-between mb-4">
                        <span className="font-mono text-[11px] font-extrabold uppercase tracking-[0.25em] text-[#ffb7c5]">
                          {t("Promo Code Activation", "АКТИВАЦИЯ ПРОМОКОДА")}
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsPromoModalOpen(false)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#2d1f24] bg-[#140d11] text-[#ffb7c5] hover:border-[#ffb7c5] hover:text-white transition cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                      <p className="text-xs text-[#8a7882] leading-relaxed mb-3.5">
                        {t(
                          "Enter secret promo code or license extension key to instantly add subscription days:",
                          "Введите секретный промокод или ключ продления лицензии для мгновенного начисления дней к вашей подписке:"
                        )}
                      </p>
                      <form onSubmit={handleRedeemPromo} className="space-y-3">
                        <input
                          type="text"
                          placeholder="SAKURA-VIP"
                          value={promoCodeInput}
                          onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                          disabled={isRedeemingPromo}
                          className="w-full rounded-xl border border-[#3a2a31] bg-[#120b0e] px-4 py-3 text-xs font-mono uppercase tracking-[0.12em] text-white placeholder:text-gray-600 focus:border-[#ffb7c5] focus:outline-none transition"
                        />
                        <button
                          type="submit"
                          disabled={isRedeemingPromo || !promoCodeInput.trim()}
                          className="w-full py-3 rounded-xl bg-[#ff2d75] border-none text-white text-xs font-black uppercase tracking-[0.14em] cursor-pointer shadow-[0_0_24px_rgba(255,45,117,0.4)] hover:bg-[#ff4887] transition disabled:opacity-50"
                        >
                          {isRedeemingPromo ? t("Applying...", "ПРИМЕНЯЕМ...") : t("Redeem Promo Code", "ВВЕСТИ ПРОМОКОД")}
                        </button>
                      </form>
                      {promoSuccessMessage && (
                        <p className="mt-3 text-xs text-[#8ce5b2] font-medium flex items-center gap-1.5">
                          <span>✓</span> {promoSuccessMessage}
                        </p>
                      )}
                      {promoErrorMessage && (
                        <p className="mt-3 text-xs text-[#ff9aa9] font-medium flex items-center gap-1.5">
                          <span>⚠</span> {promoErrorMessage}
                        </p>
                      )}
                    </div>
                  </div>,
                  document.body
                )
              : null}
          </section>
        ) : null}
      </div>
      {activeProfile ? (
        <>
          {shouldPlayProfileThemeSong && !isAdminPanelOpen ? (
            <div className="fixed top-6 left-6 z-40 flex flex-col items-start gap-3">
              <button
                type="button"
                onClick={() => setIsProfileThemePanelOpen((currentValue) => !currentValue)}
                aria-expanded={isProfileThemePanelOpen}
                className={`inline-flex items-center gap-2 justify-center rounded-full border px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] shadow-[0_0_24px_rgba(255,183,197,0.12)] transition ${
                  isProfileThemePanelOpen
                    ? "border-[#ffb7c5]/45 bg-[#ffb7c5] text-black hover:bg-[#ffc8d3]"
                    : "border-[#ffb7c5]/35 bg-[#140d11] text-[#ffb7c5] hover:border-[#ffb7c5]/60 hover:text-white"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    profileThemeIsPlaying ? "bg-[#ff7da0] shadow-[0_0_14px_rgba(255,125,160,0.9)]" : "bg-current/60"
                  }`}
                />
                {t("Music", "Музыка")}
              </button>
              {isProfileThemePanelOpen ? (
                <div className="w-[min(88vw,272px)] rounded-[24px] border border-[#372028] bg-[radial-gradient(circle_at_top_left,rgba(255,183,197,0.18),transparent_54%),linear-gradient(180deg,rgba(22,13,17,0.98)_0%,rgba(8,8,9,0.98)_100%)] p-4 shadow-[0_0_38px_rgba(255,183,197,0.14)] backdrop-blur-md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[10px] uppercase tracking-[0.34em] text-[#ffb7c5]">
                        Profile Theme
                      </p>
                      <p className="mt-2 truncate text-[15px] font-semibold tracking-[-0.02em] text-white">
                        {profileThemeTitle ?? "Profile Theme"}
                      </p>
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${
                        profileThemeIsPlaying
                          ? "border-[#ffb7c5]/40 bg-[#1b1015] text-[#ffb7c5] shadow-[0_0_16px_rgba(255,183,197,0.16)]"
                          : "border-[#2d2d2d] bg-[#111111] text-gray-400"
                      }`}
                    >
                      {profileThemeIsPlaying ? "Playing" : "Paused"}
                    </span>
                  </div>
                  {profileThemeUsesEmbeddedPlayer ? (
                    <div className="mt-4 rounded-[20px] border border-[#2a181d] bg-[linear-gradient(180deg,rgba(18,11,14,0.96)_0%,rgba(11,11,12,0.96)_100%)] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,183,197,0.04)]">
                      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-gray-400">
                        Source: {profileThemeTitle ?? "External"}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {profileThemeSourceUrl ? (
                          <a
                            href={profileThemeSourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center rounded-full border border-[#3a2a31] bg-[#140d11] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#ffb7c5] transition hover:border-[#ffb7c5]/45 hover:text-white"
                          >
                            Open Source
                          </a>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  <div className="mt-4 rounded-[20px] border border-[#2a181d] bg-[linear-gradient(180deg,rgba(18,11,14,0.96)_0%,rgba(11,11,12,0.96)_100%)] p-3 shadow-[inset_0_1px_0_rgba(255,183,197,0.04)]">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          void handleProfileThemeToggle();
                        }}
                        aria-label={profileThemeIsPlaying ? "Pause music" : "Play music"}
                        className={`inline-flex h-10 min-w-10 shrink-0 items-center justify-center rounded-full border transition ${
                          profileThemeIsPlaying
                            ? "border-[#ffb7c5]/45 bg-[#ffb7c5] text-black shadow-[0_0_22px_rgba(255,183,197,0.22)] hover:bg-[#ffc8d3]"
                            : "border-[#ffb7c5]/35 bg-[linear-gradient(180deg,#241118_0%,#140d11_100%)] text-[#ffb7c5] shadow-[0_0_18px_rgba(255,183,197,0.16)] hover:border-[#ffb7c5]/60 hover:text-white"
                        }`}
                      >
                        <MusicGlyph playing={profileThemeIsPlaying} />
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3 text-[10px] font-medium text-gray-400">
                          <span>{formatAudioClock(profileThemeDisplayedCurrentTime)}</span>
                          <span>{formatAudioClock(profileThemeDisplayedDuration)}</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={profileThemeDisplayedDuration > 0 ? profileThemeDisplayedDuration : 0}
                          step={0.1}
                          value={profileThemeDisplayedCurrentTime}
                          onChange={handleProfileThemeSeek}
                          disabled={profileThemeDisplayedDuration <= 0}
                          style={buildMusicSliderStyle(
                            profileThemeDisplayedCurrentTime,
                            profileThemeDisplayedDuration > 0 ? profileThemeDisplayedDuration : 1
                          )}
                          className={`mt-2 ${musicSliderClassName}`}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 rounded-[18px] border border-[#26151a] bg-[linear-gradient(180deg,rgba(16,10,13,0.94)_0%,rgba(10,10,11,0.94)_100%)] px-3 py-2.5">
                    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                      <span className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#ffb7c5]">
                        Volume
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={profileThemeVolume}
                        onChange={handleProfileThemeVolumeChange}
                        style={buildMusicSliderStyle(profileThemeVolume, 1)}
                        className={musicSliderClassName}
                      />
                      <span className="w-10 shrink-0 text-right text-[10px] font-medium text-gray-400">
                        {Math.round(profileThemeVolume * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          {isClientMounted && !isAdminPanelOpen && canOpenAdminPanel ? (
            typeof document !== "undefined" && document.getElementById("sakura-admin-bar-slot") ? (
              createPortal(
                <button
                  type="button"
                  onClick={() => {
                    setIsAdminPanelOpen(true);
                    loadAdminPromoCodes();
                  }}
                  aria-label="Open admin panel"
                  className={`group flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] shadow-[0_0_25px_rgba(255,183,197,0.18)] backdrop-blur-md transition-all hover:scale-105 ${
                    isTargetBanned
                      ? "border-[#ff5a54]/60 bg-[#1a0a0d] text-[#ffb3ad] hover:border-[#ff5a54] hover:shadow-[0_0_30px_rgba(255,90,84,0.3)]"
                      : "border-[#ffb7c5]/40 bg-[#140b0f]/90 text-[#ffb7c5] hover:border-[#ffb7c5] hover:text-white hover:shadow-[0_0_30px_rgba(255,183,197,0.3)]"
                  }`}
                >
                  <SakuraIcon className="h-3.5 w-3.5 transition group-hover:rotate-45" />
                  <span>{t("Admin Panel", "Админ-панель")}</span>
                  {isTargetBanned && (
                    <span className="h-2 w-2 rounded-full bg-[#ff5a54] animate-pulse" />
                  )}
                </button>,
                document.getElementById("sakura-admin-bar-slot")!
              )
            ) : (
              <div className="fixed bottom-4 right-[230px] z-[121] flex items-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsAdminPanelOpen(true);
                    loadAdminPromoCodes();
                  }}
                  aria-label="Open admin panel"
                  className={`group flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] shadow-[0_0_25px_rgba(255,183,197,0.18)] backdrop-blur-md transition-all hover:scale-105 ${
                    isTargetBanned
                      ? "border-[#ff5a54]/60 bg-[#1a0a0d] text-[#ffb3ad] hover:border-[#ff5a54] hover:shadow-[0_0_30px_rgba(255,90,84,0.3)]"
                      : "border-[#ffb7c5]/40 bg-[#140b0f]/90 text-[#ffb7c5] hover:border-[#ffb7c5] hover:text-white hover:shadow-[0_0_30px_rgba(255,183,197,0.3)]"
                  }`}
                >
                  <SakuraIcon className="h-3.5 w-3.5 transition group-hover:rotate-45" />
                  <span>{t("Admin Panel", "Админ-панель")}</span>
                  {isTargetBanned && (
                    <span className="h-2 w-2 rounded-full bg-[#ff5a54] animate-pulse" />
                  )}
                </button>
              </div>
            )
          ) : null}

          {canOpenAdminPanel && isAdminPanelOpen ? (
            <div className="fixed inset-0 z-50 flex items-center justify-end">
              <button
                type="button"
                aria-label="Close admin panel"
                onClick={() => setIsAdminPanelOpen(false)}
                className="absolute inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
              />
              <aside className="relative flex h-full w-[min(96vw,620px)] flex-col overflow-hidden border-l border-[#2a171c] bg-[#0a0709] shadow-[0_0_100px_rgba(255,183,197,0.15)]">
                {/* Header */}
                <div className="border-b border-[#1f1317] bg-[radial-gradient(circle_at_top,rgba(255,183,197,0.18),transparent_70%)] px-6 py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <SakuraIcon className="h-4 w-4 text-[#ffb7c5]" />
                        <p className="font-mono text-xs uppercase tracking-[0.35em] text-[#ffb7c5]">
                          {t("Admin Control Center", "Центр администрирования")}
                        </p>
                      </div>
                      <h2 className="mt-1 text-base font-bold text-white">
                        {primaryName} {hasUsername ? <span className="text-gray-400 font-mono text-xs font-normal">@{activeProfile.login}</span> : null}
                      </h2>
                      <p className="text-[11px] text-gray-500 font-mono">
                        UID: #{activeProfile.profileId ?? "?"} {activeProfile.email ? `· ${activeProfile.email}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAdminPanelOpen(false)}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#311c24] bg-[#160c10] text-gray-400 transition hover:border-[#ffb7c5]/50 hover:text-white"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Tab Navigation */}
                  <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    {[
                      { id: "sub", label: t("Sub & HWID", "Подписка и HWID") },
                      { id: "roles", label: t("Roles", "Роли") },
                      { id: "promos", label: t("Promo Codes", "Промокоды") },
                      { id: "security", label: t("Security", "Безопасность") },
                      { id: "edit", label: t("Moderation", "Модерация") },
                    ].map((tab) => {
                      const isActive = adminPanelActiveTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setAdminPanelActiveTab(tab.id as any)}
                          className={`flex shrink-0 items-center rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.1em] transition ${
                            isActive
                              ? "border border-[#ffb7c5]/60 bg-[#ffb7c5] text-black shadow-[0_0_16px_rgba(255,183,197,0.25)]"
                              : "border border-[#23151a] bg-[#120a0e] text-gray-400 hover:border-[#ffb7c5]/35 hover:text-white"
                          }`}
                        >
                          <span>{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tab Content Body */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                  {/* TAB 1: SUBSCRIPTION & HWID */}
                  {adminPanelActiveTab === "sub" && (
                    <div className="space-y-4">
                      {/* Subscription Status Card */}
                      <section className="rounded-[24px] border border-[#23151b] bg-[#10090d] p-5">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-gray-400">
                              {t("Subscription Access", "Доступ по подписке")}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-white">
                              {hasLifetimeRole
                                ? t("Lifetime Subscription", "Подписка Навсегда (Lifetime)")
                                : hasActiveSubscriptionRole
                                ? t("Active Subscription", "Подписка активна")
                                : t("No active subscription", "Подписка неактивна")}
                            </p>
                            <p className="mt-0.5 text-xs text-gray-400 font-mono">
                              {profileSubscriptionUntilLabel}
                            </p>
                          </div>
                          <span
                            className={`inline-flex shrink-0 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${
                              hasLifetimeRole
                                ? "border-[#facc15]/40 bg-[#1f1a08] text-[#facc15]"
                                : hasActiveSubscriptionRole
                                ? "border-[#1f3b2f] bg-[#0d1713] text-[#8ce5b2]"
                                : "border-[#3a3a3a] bg-[#111111] text-[#a3a3a3]"
                            }`}
                          >
                            {hasLifetimeRole ? "Lifetime" : hasActiveSubscriptionRole ? t("Active", "Активна") : t("Inactive", "Неактивна")}
                          </span>
                        </div>

                        {/* Quick Grant / Revoke / Freeze Actions */}
                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={handleAdminGrantActiveSubscription}
                            disabled={isAdminSubscriptionSaving || isRolesSaving || hasSubscriberRole || hasLifetimeRole}
                            className="inline-flex items-center justify-center rounded-xl border border-[#ffb7c5]/30 bg-[#ffb7c5] px-3 py-2 text-xs font-bold uppercase tracking-[0.1em] text-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isAdminSubscriptionSaving ? t("Saving...", "Сохранение...") : t("Grant 30 Days", "Выдать 30 дней")}
                          </button>
                          <button
                            type="button"
                            onClick={handleAdminGrantLifetimeSubscription}
                            disabled={isAdminSubscriptionSaving || isRolesSaving || hasLifetimeRole}
                            className="inline-flex items-center justify-center rounded-xl border border-[#facc15]/45 bg-[#facc15] px-3 py-2 text-xs font-bold uppercase tracking-[0.1em] text-black transition hover:bg-[#fde047] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isAdminSubscriptionSaving ? t("Saving...", "Сохранение...") : t("Grant Lifetime", "Выдать навсегда")}
                          </button>
                          <button
                            type="button"
                            onClick={handleAdminRevokeActiveSubscription}
                            disabled={isAdminSubscriptionSaving || isRolesSaving || !hasSubscriberRole}
                            className="inline-flex items-center justify-center rounded-xl border border-[#3a2029] bg-[#160c11] px-3 py-2 text-xs font-bold uppercase tracking-[0.1em] text-[#ffb7c5] transition hover:border-[#ffb7c5] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {t("Revoke 30D", "Снять подписку")}
                          </button>
                          <button
                            type="button"
                            onClick={handleAdminRevokeLifetimeSubscription}
                            disabled={isAdminSubscriptionSaving || isRolesSaving || !hasLifetimeRole}
                            className="inline-flex items-center justify-center rounded-xl border border-[#3a2029] bg-[#160c11] px-3 py-2 text-xs font-bold uppercase tracking-[0.1em] text-[#ffb7c5] transition hover:border-[#ffb7c5] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {t("Revoke Lifetime", "Снять Lifetime")}
                          </button>
                        </div>

                        {/* Freeze Button */}
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={handleAdminToggleFreeze}
                            disabled={isAdminSubscriptionSaving || isRolesSaving}
                            className={`w-full inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] transition disabled:opacity-50 ${
                              activeProfile?.isFrozen
                                ? "border-[#f97316]/60 bg-gradient-to-r from-[#ea580c] to-[#f97316] text-white shadow-[0_0_16px_rgba(249,115,22,0.35)]"
                                : "border-[#38bdf8]/40 bg-[#082f49]/60 text-[#7dd3fc] hover:border-[#38bdf8] hover:text-white"
                            }`}
                          >
                            <span>{activeProfile?.isFrozen ? t("Unfreeze Subscription", "Разморозить подписку") : t("Freeze Subscription", "Заморозить подписку")}</span>
                          </button>
                        </div>

                        {adminSubscriptionError && <p className="mt-3 text-xs text-[#ff9aa9]">⚠ {adminSubscriptionError}</p>}
                        {adminSubscriptionSuccess && <p className="mt-3 text-xs text-[#8ce5b2]">✓ {adminSubscriptionSuccess}</p>}
                      </section>

                      {/* Precise Expiry & Offsets Card */}
                      <section className="rounded-[24px] border border-[#23151b] bg-[#10090d] p-5">
                        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-gray-400">
                          {t("Set Expiration Date", "Точная дата окончания")}
                        </p>
                        {hasLifetimeRole ? (
                          <p className="mt-2 text-xs text-gray-400">
                            {t("Lifetime subscription has no end date.", "У подписки Lifetime нет даты окончания.")}
                          </p>
                        ) : (
                          <>
                            <div className="mt-3">
                              <input
                                type="datetime-local"
                                value={adminSubscriptionUntilInput}
                                onChange={(e) => {
                                  setAdminSubscriptionUntilInput(e.target.value);
                                  setAdminSubscriptionUntilError(null);
                                  setAdminSubscriptionUntilSuccess(null);
                                }}
                                className="w-full rounded-xl border border-[#2e1a22] bg-[#080507] px-4 py-2.5 text-xs text-white outline-none focus:border-[#ffb7c5]"
                              />
                            </div>
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {[
                                { label: "+1D", days: 1 },
                                { label: "+3D", days: 3 },
                                { label: "+1W", days: 7 },
                                { label: "+1M", months: 1 },
                                { label: "+1Y", years: 1 },
                              ].map((btn, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => applyAdminSubscriptionUntilOffset(btn.months ? { months: btn.months } : btn.years ? { years: btn.years } : { days: btn.days! })}
                                  disabled={isAdminSubscriptionUntilSaving}
                                  className="rounded-lg border border-[#311c24] bg-[#140b0f] px-2.5 py-1 text-xs font-mono font-bold text-[#ffb7c5] hover:border-[#ffb7c5] transition"
                                >
                                  {btn.label}
                                </button>
                              ))}
                            </div>
                            <div className="mt-3">
                              <button
                                type="button"
                                onClick={handleAdminSubscriptionUntilSave}
                                disabled={isAdminSubscriptionUntilSaving}
                                className="rounded-xl border border-[#ffb7c5]/40 bg-[#ffb7c5] px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-black transition hover:bg-white disabled:opacity-50"
                              >
                                {isAdminSubscriptionUntilSaving ? t("Saving...", "Сохранение...") : t("Save Date", "Сохранить дату")}
                              </button>
                            </div>
                            {adminSubscriptionUntilError && <p className="mt-2 text-xs text-[#ff9aa9]">⚠ {adminSubscriptionUntilError}</p>}
                            {adminSubscriptionUntilSuccess && <p className="mt-2 text-xs text-[#8ce5b2]">✓ {adminSubscriptionUntilSuccess}</p>}
                          </>
                        )}
                      </section>

                      {/* HWID Management Card */}
                      <section className="rounded-[24px] border border-[#23151b] bg-[#10090d] p-5">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-gray-400">HWID Binding</p>
                            <p className="mt-1 font-mono text-xs text-gray-300 break-all">
                              {profileHwid ?? t("Not bound to any hardware", "Не привязан к железу")}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={handleAdminResetHwid}
                            disabled={isAdminHwidResetting || !profileHwid}
                            className="inline-flex shrink-0 items-center justify-center rounded-xl border border-[#ffb7c5]/30 bg-[#160c11] px-3.5 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#ffb7c5] transition hover:border-[#ffb7c5] hover:text-white disabled:opacity-50"
                          >
                            {isAdminHwidResetting ? t("Resetting...", "Сброс...") : t("Reset HWID", "Сбросить HWID")}
                          </button>
                        </div>
                        {adminHwidError && <p className="mt-2 text-xs text-[#ff9aa9]">⚠ {adminHwidError}</p>}
                        {adminHwidSuccess && <p className="mt-2 text-xs text-[#8ce5b2]">✓ {adminHwidSuccess}</p>}
                      </section>
                    </div>
                  )}

                  {/* TAB 2: ROLES */}
                  {adminPanelActiveTab === "roles" && (
                    <div className="space-y-4">
                      <section className="rounded-[24px] border border-[#23151b] bg-[#10090d] p-5">
                        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#ffb7c5]">
                          {t("Assigned Roles", "Назначенные роли")}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {normalizedDraftRoles.map((role) => {
                            const isLastUserRole =
                              normalizedDraftRoles.length === 1 &&
                              normalizeRoleName(role) === "user";

                            return (
                              <button
                                key={role}
                                type="button"
                                title={roleBadgeLabel(role)}
                                onClick={() => removeRole(role)}
                                disabled={isLastUserRole || isRolesSaving}
                                style={{ ...roleBadgeStyle(role), ...roleBadgeTextStyle }}
                                className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-bold transition hover:opacity-80 disabled:opacity-50"
                              >
                                <span>{renderRoleBadgeText(role)}</span>
                                <span className="ml-1 text-sm font-bold text-red-400">×</span>
                              </button>
                            );
                          })}
                        </div>

                        <div className="mt-6 border-t border-[#1e1318] pt-4">
                          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-gray-400">
                            {t("Available Roles to Add", "Доступные роли для добавления")}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {availableRoleOptions.map((role) => (
                              <button
                                key={role}
                                type="button"
                                title={roleBadgeLabel(role)}
                                onClick={() => addRole(role)}
                                disabled={isRolesSaving}
                                className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-[#2a1720] bg-[#140b0f] px-3.5 py-1.5 text-xs font-semibold text-gray-400 transition hover:border-[#ffb7c5]/50 hover:text-white disabled:opacity-40"
                              >
                                <span className="text-[#ffb7c5] font-bold">+</span>
                                <span>{renderRoleBadgeText(role)}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="mt-6 flex items-center gap-3 border-t border-[#1e1318] pt-4">
                          <button
                            type="button"
                            onClick={handleRolesSave}
                            disabled={isRolesSaving || !hasRoleChanges}
                            className="rounded-full border border-[#ffb7c5]/40 bg-[#ffb7c5] px-5 py-2 text-xs font-bold uppercase tracking-[0.12em] text-black transition hover:bg-white disabled:opacity-50"
                          >
                            {isRolesSaving ? t("Saving...", "Сохранение...") : t("Save Roles", "Сохранить роли")}
                          </button>
                          <button
                            type="button"
                            onClick={resetRoles}
                            disabled={isRolesSaving || !hasRoleChanges}
                            className="rounded-full border border-[#2a1720] bg-[#140b0f] px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#ffb7c5] transition hover:border-[#ffb7c5] hover:text-white disabled:opacity-50"
                          >
                            {t("Reset Changes", "Сбросить изменения")}
                          </button>
                        </div>
                        {rolesError && <p className="mt-3 text-xs text-[#ff9aa9]">⚠ {rolesError}</p>}
                        {rolesSuccess && <p className="mt-3 text-xs text-[#8ce5b2]">✓ {rolesSuccess}</p>}
                      </section>
                    </div>
                  )}

                  {/* TAB 3: PROMO CODES */}
                  {adminPanelActiveTab === "promos" && (
                    <div className="space-y-4">
                      {/* Generator Card */}
                      <section className="rounded-[24px] border border-[#ffb7c5]/25 bg-[radial-gradient(circle_at_top_left,rgba(255,183,197,0.06),transparent_60%),#10090d] p-5 shadow-[0_0_24px_rgba(255,183,197,0.06)]">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#ffb7c5]">
                            {t("Promo Codes Generator", "Генератор промокодов")}
                          </p>
                          <button
                            type="button"
                            onClick={loadAdminPromoCodes}
                            disabled={isAdminPromoLoading}
                            className="text-xs text-gray-400 hover:text-white transition"
                          >
                            {isAdminPromoLoading ? t("Loading...", "Загрузка...") : t("Refresh List", "Обновить список")}
                          </button>
                        </div>

                        <div className="mt-4 space-y-3.5">
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="text"
                              value={adminPromoCodeInput}
                              onChange={(e) => setAdminPromoCodeInput(e.target.value.toUpperCase())}
                              placeholder={t("Code (e.g. SAKURA-VIP)", "Промокод (например, SAKURA-VIP)")}
                              maxLength={32}
                              className="flex-1 rounded-xl border border-[#311c24] bg-[#090507] px-3.5 py-2 text-xs font-mono font-bold uppercase text-white outline-none focus:border-[#ffb7c5]"
                            />
                            <button
                              type="button"
                              onClick={generateRandomPromoCode}
                              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[#3a2a31] bg-[#160c11] px-4 py-2 text-xs font-semibold text-[#ffb7c5] transition hover:bg-[#22131b]"
                            >
                              <span>{t("Random", "Случайный")}</span>
                            </button>
                          </div>

                          {/* Duration presets */}
                          <div>
                            <p className="mb-1.5 text-[10px] font-mono uppercase tracking-[0.18em] text-gray-400">
                              {t("Duration", "Длительность")}
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {[
                                { label: t("1 Day", "1 День"), days: 1 },
                                { label: t("3 Days", "3 Дня"), days: 3 },
                                { label: t("7 Days", "7 Дней"), days: 7 },
                                { label: t("14 Days", "14 Дней"), days: 14 },
                                { label: t("30 Days", "30 Дней"), days: 30 },
                                { label: t("90 Days", "90 Дней"), days: 90 },
                                { label: t("365 Days", "1 Год"), days: 365 },
                                { label: t("Lifetime", "Навсегда"), days: 0 },
                              ].map((preset) => {
                                const isSelected = adminPromoDaysInput === preset.days;
                                return (
                                  <button
                                    key={preset.days}
                                    type="button"
                                    onClick={() => setAdminPromoDaysInput(preset.days)}
                                    className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                                      isSelected
                                        ? "border border-[#ffb7c5]/60 bg-[#ffb7c5] text-black shadow-[0_0_12px_rgba(255,183,197,0.3)]"
                                        : "border border-[#2a1a21] bg-[#090507] text-gray-400 hover:text-white"
                                    }`}
                                  >
                                    {preset.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <p className="mb-1.5 text-[10px] font-mono uppercase tracking-[0.18em] text-gray-400">
                                {t("Max Activations", "Макс. использований")}
                              </p>
                              <input
                                type="number"
                                min={1}
                                max={9999}
                                value={adminPromoUsesInput}
                                onChange={(e) => setAdminPromoUsesInput(Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-full rounded-xl border border-[#311c24] bg-[#090507] px-3.5 py-1.5 text-xs text-white outline-none focus:border-[#ffb7c5]"
                              />
                            </div>
                            <div>
                              <p className="mb-1.5 text-[10px] font-mono uppercase tracking-[0.18em] text-gray-400">
                                {t("Note / Description", "Примечание")}
                              </p>
                              <input
                                type="text"
                                maxLength={64}
                                value={adminPromoNoteInput}
                                onChange={(e) => setAdminPromoNoteInput(e.target.value)}
                                placeholder={t("e.g. VK Giveaway", "например, розыгрыш")}
                                className="w-full rounded-xl border border-[#311c24] bg-[#090507] px-3.5 py-1.5 text-xs text-white outline-none placeholder:text-gray-600 focus:border-[#ffb7c5]"
                              />
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={handleAdminCreatePromo}
                            disabled={isAdminPromoCreating}
                            className="inline-flex items-center justify-center gap-2 rounded-full border border-[#ffb7c5]/40 bg-[#ffb7c5] px-5 py-2 text-xs font-bold uppercase tracking-[0.14em] text-black shadow-[0_0_16px_rgba(255,183,197,0.25)] transition hover:bg-white disabled:opacity-60"
                          >
                            <span>{isAdminPromoCreating ? t("Creating...", "Создание...") : t("Create Promo Code", "Создать промокод")}</span>
                          </button>

                          {adminPromoError && <p className="text-xs text-[#ff9aa9]">⚠ {adminPromoError}</p>}
                          {adminPromoSuccess && <p className="text-xs text-[#8ce5b2]">✓ {adminPromoSuccess}</p>}
                        </div>
                      </section>

                      {/* Active Promo Codes List Card */}
                      <section className="rounded-[24px] border border-[#23151b] bg-[#10090d] p-5">
                        <p className="mb-3 text-[10px] font-mono uppercase tracking-[0.2em] text-gray-400">
                          {t("Active Promo Codes", "Активные промокоды")} ({adminPromoList.length})
                        </p>
                        {adminPromoList.length === 0 ? (
                          <div className="rounded-xl border border-[#201519] bg-[#0c080a] p-4 text-center text-xs text-gray-500">
                            {t("No promo codes generated yet.", "Пока нет созданных промокодов.")}
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                            {adminPromoList.map((promo) => (
                              <div
                                key={promo.id || promo.code}
                                className="flex items-center justify-between gap-3 rounded-xl border border-[#281b21] bg-[#090507] px-3.5 py-2.5 text-xs"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-mono font-bold tracking-wider text-[#ffb7c5]">
                                      {promo.code}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard.writeText(promo.code);
                                        alert(t(`Copied: ${promo.code}`, `Скопировано: ${promo.code}`));
                                      }}
                                      className="rounded bg-[#1e1217] px-2 py-0.5 text-[10px] font-semibold text-gray-300 hover:text-white transition"
                                    >
                                      {t("Copy", "Копировать")}
                                    </button>
                                    <span className="rounded bg-[#1e1217] px-2 py-0.5 text-[10px] font-semibold text-gray-300">
                                      {promo.durationDays === 0 ? t("Lifetime", "Навсегда") : `${promo.durationDays} ${t("days", "дн.")}`}
                                    </span>
                                    <span className="rounded bg-[#181114] px-1.5 py-0.5 text-[10px] text-gray-400">
                                      {promo.usedCount || 0} / {promo.maxUses}
                                    </span>
                                  </div>
                                  {promo.note && (
                                    <p className="mt-0.5 truncate text-[11px] text-gray-400">{promo.note}</p>
                                  )}
                                  {Array.isArray(promo.activations) && promo.activations.length > 0 && (
                                    <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-gray-500">
                                      <span className="text-[#8ce5b2]">{t("Used by:", "Активировали:")}</span>
                                      {promo.activations.slice(0, 5).map((act: any, idx: number) => (
                                        <span key={idx} className="rounded bg-[#1a1115] px-1.5 py-0.5 text-gray-300 font-mono">
                                          {act.login ? `@${act.login}` : `#${act.profileId}`}
                                        </span>
                                      ))}
                                      {promo.activations.length > 5 && (
                                        <span>+{promo.activations.length - 5}</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleAdminDeletePromo(promo.id || promo.code)}
                                  className="rounded bg-[#1e1217] px-2.5 py-1 text-[11px] text-gray-400 hover:text-[#ff5a54] transition"
                                >
                                  {t("Delete", "Удалить")}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </section>
                    </div>
                  )}

                  {/* TAB 4: SECURITY & BAN */}
                  {adminPanelActiveTab === "security" && (
                    <div className="space-y-4">
                      {/* Email Verification Card */}
                      <section className="rounded-[24px] border border-[#23151b] bg-[#10090d] p-5">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-gray-400">
                              {t("Email Verification", "Подтверждение почты")}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-white">
                              {targetVerificationStatus === "no-email"
                                ? t("No email attached", "Почта не привязана")
                                : targetVerificationStatus === "locked"
                                ? t("Verification required", "Требуется подтверждение")
                                : targetVerificationStatus === "verified"
                                ? t("Email verified", "Почта подтверждена")
                                : t("State unknown", "Статус неизвестен")}
                            </p>
                            <p className="text-xs text-gray-500 font-mono">
                              {activeProfile.email || t("No email stored", "Нет сохраненной почты")}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={handleAdminVerificationToggle}
                            disabled={
                              isAdminVerificationSaving ||
                              !activeProfile.email ||
                              (isAdminSelfTarget && isTargetVerified)
                            }
                            className={`rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] transition disabled:opacity-50 ${
                              isTargetVerificationLocked
                                ? "border border-[#1f3b2f] bg-[#0d1713] text-[#8ce5b2] hover:border-[#8ce5b2]"
                                : "border border-[#ffb7c5]/35 bg-[#ffb7c5] text-black hover:bg-white"
                            }`}
                          >
                            {isAdminVerificationSaving
                              ? t("Saving...", "Сохранение...")
                              : isTargetVerificationLocked || targetVerificationStatus === "unknown"
                              ? t("Mark Verified", "Отметить подтверждённой")
                              : t("Revoke Verification", "Отозвать подтверждение")}
                          </button>
                        </div>
                        {isAdminSelfTarget && isTargetVerified && (
                          <p className="mt-2 text-xs text-gray-500">
                            {t("Self-revoke is blocked to prevent losing access.", "Самоотзыв заблокирован.")}
                          </p>
                        )}
                        {adminVerificationError && <p className="mt-2 text-xs text-[#ff9aa9]">⚠ {adminVerificationError}</p>}
                        {adminVerificationSuccess && <p className="mt-2 text-xs text-[#8ce5b2]">✓ {adminVerificationSuccess}</p>}
                      </section>

                      {/* Password Reset Card */}
                      <section className="rounded-[24px] border border-[#23151b] bg-[#10090d] p-5">
                        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-gray-400">
                          {t("Password Recovery", "Восстановление пароля")}
                        </p>
                        <p className="mt-1 text-xs text-gray-400">
                          {t("Send a password reset link to the user's email.", "Отправить ссылку для сброса пароля на почту пользователя.")}
                        </p>
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={handleAdminPasswordResetRequest}
                            disabled={isAdminPasswordResetSending || isAccountDeleting || !activeProfile.email}
                            className="rounded-xl border border-[#3a2029] bg-[#160c11] px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#ffb7c5] hover:border-[#ffb7c5] hover:text-white transition disabled:opacity-50"
                          >
                            {isAdminPasswordResetSending ? t("Sending...", "Отправка...") : t("Send Reset Link", "Отправить ссылку сброса")}
                          </button>
                        </div>
                        {adminPasswordResetError && <p className="mt-2 text-xs text-[#ff9aa9]">⚠ {adminPasswordResetError}</p>}
                        {adminPasswordResetSuccess && <p className="mt-2 text-xs text-[#8ce5b2]">✓ {adminPasswordResetSuccess}</p>}
                      </section>

                      {/* Ban / Unban Card */}
                      <section className="rounded-[24px] border border-[#23151b] bg-[#10090d] p-5">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-gray-400">
                              {t("Account Ban Status", "Блокировка аккаунта")}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-white">
                              {isTargetBanned ? t("Account is banned", "Аккаунт заблокирован") : t("Account is in good standing", "Аккаунт не заблокирован")}
                            </p>
                            {activeProfile.bannedAt && (
                              <p className="text-xs text-gray-500 font-mono">
                                {t("Banned on", "Забанен")}: {formatTime(activeProfile.bannedAt, locale)}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={handleBanToggle}
                            disabled={isBanSaving || (isAdminSelfTarget && !isTargetBanned)}
                            className={`rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] transition disabled:opacity-50 ${
                              isTargetBanned
                                ? "border border-[#1f3b2f] bg-[#0d1713] text-[#8ce5b2] hover:border-[#8ce5b2]"
                                : "border border-[#ff5a54]/50 bg-[#ff5a54] text-black hover:bg-[#ff746f]"
                            }`}
                          >
                            {isBanSaving ? t("Saving...", "Сохранение...") : isTargetBanned ? t("Unban Account", "Разблокировать аккаунт") : t("Ban Account", "Заблокировать аккаунт")}
                          </button>
                        </div>
                        {isAdminSelfTarget && !isTargetBanned && (
                          <p className="mt-2 text-xs text-gray-500">
                            {t("Self-ban is blocked to prevent losing root access.", "Самоблокировка запрещена.")}
                          </p>
                        )}
                        {banError && <p className="mt-2 text-xs text-[#ff9aa9]">⚠ {banError}</p>}
                        {banSuccess && <p className="mt-2 text-xs text-[#8ce5b2]">✓ {banSuccess}</p>}
                      </section>

                      {/* Danger Zone: Account Deletion */}
                      <section className="rounded-[24px] border border-[#4a1a20] bg-[#14080a] p-5">
                        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#ff746f]">
                          {t("Danger Zone", "Опасная зона")}
                        </p>
                        <p className="mt-1 text-xs text-gray-400">
                          {t("Permanently delete this user account and all associated data.", "Безвозвратно удалить этот аккаунт пользователя и все связанные данные.")}
                        </p>
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={handleDeleteAccount}
                            disabled={isAccountDeleting || isAdminPasswordResetSending}
                            className="rounded-xl border border-[#ff5a54]/50 bg-[#ff5a54] px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-black hover:bg-[#ff746f] transition disabled:opacity-40"
                          >
                            {isAccountDeleting ? t("Deleting...", "Удаление...") : t("Delete Account", "Удалить аккаунт")}
                          </button>
                        </div>
                        {deleteAccountError && <p className="mt-2 text-xs text-[#ff9aa9]">⚠ {deleteAccountError}</p>}
                      </section>
                    </div>
                  )}

                  {/* TAB 5: PROFILE MODERATION */}
                  {adminPanelActiveTab === "edit" && (
                    <div className="space-y-4">
                      {/* Display Name Moderation */}
                      <section className="rounded-[24px] border border-[#23151b] bg-[#10090d] p-5">
                        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-gray-400">
                          {t("Display Name", "Отображаемое имя")}
                        </p>
                        <div className="mt-3 flex gap-2">
                          <input
                            type="text"
                            value={displayNameInput}
                            maxLength={48}
                            onChange={(e) => {
                              setDisplayNameInput(e.target.value);
                              setDisplayNameError(null);
                              setDisplayNameSuccess(null);
                            }}
                            className="flex-1 rounded-xl border border-[#2e1a22] bg-[#080507] px-3.5 py-2 text-xs text-white outline-none focus:border-[#ffb7c5]"
                            placeholder="Sakura Player"
                          />
                          <button
                            type="button"
                            onClick={handleDisplayNameSave}
                            disabled={isDisplayNameSaving}
                            className="rounded-xl border border-[#ffb7c5]/40 bg-[#ffb7c5] px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-black hover:bg-white transition disabled:opacity-50"
                          >
                            {isDisplayNameSaving ? t("Saving...", "...") : t("Save", "Сохранить")}
                          </button>
                        </div>
                        {displayNameError && <p className="mt-2 text-xs text-[#ff9aa9]">⚠ {displayNameError}</p>}
                        {displayNameSuccess && <p className="mt-2 text-xs text-[#8ce5b2]">✓ {displayNameSuccess}</p>}
                      </section>

                      {/* Login Moderation */}
                      <section className="rounded-[24px] border border-[#23151b] bg-[#10090d] p-5">
                        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-gray-400">
                          {t("Login / Username", "Логин аккаунта")}
                        </p>
                        <div className="mt-3 flex gap-2">
                          <input
                            ref={adminUsernameInputRef}
                            type="text"
                            value={usernameInput}
                            minLength={3}
                            maxLength={24}
                            onChange={(e) => {
                              setUsernameInput(e.target.value);
                              setUsernameError(null);
                              setUsernameSuccess(null);
                            }}
                            className="flex-1 rounded-xl border border-[#2e1a22] bg-[#080507] px-3.5 py-2 text-xs text-white outline-none focus:border-[#ffb7c5]"
                            placeholder="username"
                          />
                          <button
                            type="button"
                            onClick={handleUsernameSave}
                            disabled={isUsernameSaving}
                            className="rounded-xl border border-[#ffb7c5]/40 bg-[#ffb7c5] px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-black hover:bg-white transition disabled:opacity-50"
                          >
                            {isUsernameSaving ? t("Saving...", "...") : t("Save", "Сохранить")}
                          </button>
                        </div>
                        {usernameError && <p className="mt-2 text-xs text-[#ff9aa9]">⚠ {usernameError}</p>}
                        {usernameSuccess && <p className="mt-2 text-xs text-[#8ce5b2]">✓ {usernameSuccess}</p>}
                      </section>

                      {/* Avatar Moderation */}
                      <section className="rounded-[24px] border border-[#23151b] bg-[#10090d] p-5">
                        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-gray-400">
                          {t("Avatar Moderation", "Модерация аватара")}
                        </p>
                        <p className="mt-1 text-xs text-gray-400">
                          {t("Replace or delete the avatar on this account.", "Заменить или удалить аватар пользователя.")}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => adminAvatarInputRef.current?.click()}
                            disabled={isAvatarUploading || isAvatarDeleting}
                            className="rounded-xl border border-[#ffb7c5]/40 bg-[#ffb7c5] px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-black hover:bg-white transition disabled:opacity-50"
                          >
                            {isAvatarUploading ? t("Uploading...", "Загрузка...") : hasActiveProfileAvatar ? t("Replace Avatar", "Заменить аватар") : t("Upload Avatar", "Загрузить аватар")}
                          </button>
                          {hasActiveProfileAvatar && (
                            <button
                              type="button"
                              onClick={handleAvatarDelete}
                              disabled={isAvatarUploading || isAvatarDeleting}
                              className="rounded-xl border border-[#3a2029] bg-[#160c11] px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-[#ff9aa9] hover:border-[#ff9aa9] transition disabled:opacity-50"
                            >
                              {isAvatarDeleting ? t("Deleting...", "Удаление...") : t("Delete Avatar", "Удалить аватар")}
                            </button>
                          )}
                          <input
                            ref={adminAvatarInputRef}
                            type="file"
                            accept={AVATAR_FILE_ACCEPT}
                            onChange={handleAvatarChange}
                            className="hidden"
                          />
                        </div>
                        {avatarError && <p className="mt-2 text-xs text-[#ff9aa9]">⚠ {avatarError}</p>}
                        {avatarSuccess && <p className="mt-2 text-xs text-[#8ce5b2]">✓ {avatarSuccess}</p>}
                      </section>

                      {/* Banner Moderation */}
                      <section className="rounded-[24px] border border-[#23151b] bg-[#10090d] p-5">
                        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-gray-400">
                          {t("Profile Banner", "Баннер профиля")}
                        </p>
                        <p className="mt-1 text-xs text-gray-400">
                          {hasActiveProfileBanner ? t("Custom banner uploaded.", "Установлен кастомный баннер.") : t("Default Sakura pattern.", "Стандартный узор Sakura.")}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => adminBannerInputRef.current?.click()}
                            disabled={isBannerUploading || isBannerDeleting}
                            className="rounded-xl border border-[#ffb7c5]/40 bg-[#ffb7c5] px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-black hover:bg-white transition disabled:opacity-50"
                          >
                            {isBannerUploading ? t("Uploading...", "Загрузка...") : hasActiveProfileBanner ? t("Replace Banner", "Заменить баннер") : t("Upload Banner", "Загрузить баннер")}
                          </button>
                          {hasActiveProfileBanner && (
                            <button
                              type="button"
                              onClick={handleBannerDelete}
                              disabled={isBannerUploading || isBannerDeleting}
                              className="rounded-xl border border-[#3a2029] bg-[#160c11] px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-[#ff9aa9] hover:border-[#ff9aa9] transition disabled:opacity-50"
                            >
                              {isBannerDeleting ? t("Deleting...", "Удаление...") : t("Reset Banner", "Сбросить баннер")}
                            </button>
                          )}
                          <input
                            ref={adminBannerInputRef}
                            type="file"
                            accept={AVATAR_FILE_ACCEPT}
                            onChange={handleBannerChange}
                            className="hidden"
                          />
                        </div>
                        {bannerError && <p className="mt-2 text-xs text-[#ff9aa9]">⚠ {bannerError}</p>}
                        {bannerSuccess && <p className="mt-2 text-xs text-[#8ce5b2]">✓ {bannerSuccess}</p>}
                      </section>

                      {/* Theme Song Moderation */}
                      <section className="rounded-[24px] border border-[#23151b] bg-[#10090d] p-5">
                        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-gray-400">
                          {t("Theme Song", "Музыка профиля")}
                        </p>
                        <p className="mt-1 text-xs text-gray-400">
                          {t("Current song:", "Текущий трек:")} {profileThemeTitle ?? t("None", "Нет")}
                        </p>
                        <div className="mt-3 space-y-2">
                          <input
                            type="text"
                            list="profile-theme-track-options"
                            value={adminThemeSongInput}
                            onChange={(e) => {
                              setAdminThemeSongInput(e.target.value);
                              setAdminThemeSongError(null);
                              setAdminThemeSongSuccess(null);
                            }}
                            className="w-full rounded-xl border border-[#2e1a22] bg-[#080507] px-3.5 py-2 text-xs text-white outline-none focus:border-[#ffb7c5]"
                            placeholder="SoundCloud / MP3 URL"
                          />
                          <div className="flex flex-wrap gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => adminThemeSongFileInputRef.current?.click()}
                              disabled={isAdminThemeSongSaving || isAdminThemeSongUploading || isAdminThemeSongDeleting}
                              className="rounded-xl border border-[#3a2029] bg-[#160c11] px-3.5 py-2 text-xs font-semibold text-[#ffb7c5] hover:border-[#ffb7c5] transition disabled:opacity-50"
                            >
                              {isAdminThemeSongUploading ? t("Uploading...", "Загрузка...") : t("Upload MP3", "Загрузить MP3")}
                            </button>
                            <button
                              type="button"
                              onClick={handleAdminThemeSongSave}
                              disabled={isAdminThemeSongSaving || isAdminThemeSongUploading || isAdminThemeSongDeleting}
                              className="rounded-xl border border-[#ffb7c5]/40 bg-[#ffb7c5] px-4 py-2 text-xs font-bold text-black hover:bg-white transition disabled:opacity-50"
                            >
                              {isAdminThemeSongSaving ? t("Saving...", "...") : t("Save Track", "Сохранить трек")}
                            </button>
                            <button
                              type="button"
                              onClick={handleAdminThemeSongDelete}
                              disabled={isAdminThemeSongSaving || isAdminThemeSongUploading || isAdminThemeSongDeleting || isAdminThemeSongDeleteLocked}
                              className="rounded-xl border border-[#3a2029] bg-[#160c11] px-3.5 py-2 text-xs font-semibold text-[#ff9aa9] hover:border-[#ff9aa9] transition disabled:opacity-50"
                            >
                              {isAdminThemeSongDeleting ? t("Deleting...", "...") : t("Delete Track", "Удалить")}
                            </button>
                            <input
                              ref={adminThemeSongFileInputRef}
                              type="file"
                              accept={PROFILE_THEME_AUDIO_FILE_ACCEPT}
                              onChange={handleAdminThemeSongUpload}
                              className="hidden"
                            />
                          </div>
                        </div>
                        {adminThemeSongError && <p className="mt-2 text-xs text-[#ff9aa9]">⚠ {adminThemeSongError}</p>}
                        {adminThemeSongSuccess && <p className="mt-2 text-xs text-[#8ce5b2]">✓ {adminThemeSongSuccess}</p>}
                      </section>
                    </div>
                  )}
                </div>
              </aside>
            </div>
          ) : null}
        </>
      ) : null}

      {isClientMounted && isRecoveryModalOpen && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
              <div
                className="absolute inset-0 bg-black/80 backdrop-blur-md"
                onClick={closeRecoveryModal}
              />
              <div className="relative w-full max-w-md overflow-hidden rounded-[30px] border border-[#ffb7c5]/35 bg-[#0d0d0d] shadow-[0_0_80px_rgba(255,183,197,0.18)]">
                <div className="border-b border-[#2b1b1e] bg-[radial-gradient(circle_at_top,rgba(255,183,197,0.14),transparent_60%)] p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.4em] text-[#ffb7c5]">
                        Sakura Security
                      </p>
                      <h2 className="text-xl font-black uppercase tracking-tight text-white">
                        {t("Set New Password", "Новый пароль")}
                      </h2>
                      <p className="mt-1 text-xs text-gray-400">
                        {t(
                          "Enter your new password below.",
                          "Придумайте и введите новый пароль для входа в ваш аккаунт."
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={closeRecoveryModal}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#2b1b1e] bg-[#140b0f] text-gray-400 transition hover:border-[#ffb7c5]/50 hover:text-white"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <form onSubmit={handleSaveRecoveryPassword} className="p-6 space-y-4">
                  {recoveryError && (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-200">
                      {recoveryError}
                    </div>
                  )}
                  {recoverySuccess && (
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-200">
                      {recoverySuccess}
                    </div>
                  )}

                  <label className="block">
                    <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.28em] text-gray-400">
                      {t("New Password", "Новый пароль")}
                    </span>
                    <input
                      type="password"
                      value={recoveryPassword}
                      onChange={(e) => setRecoveryPassword(e.target.value)}
                      placeholder={t("Minimum 6 characters", "Минимум 6 символов")}
                      className="w-full rounded-2xl border border-[#26181d] bg-[#090909] px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-[#ffb7c5]/55"
                      autoFocus
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.28em] text-gray-400">
                      {t("Confirm Password", "Подтвердите пароль")}
                    </span>
                    <input
                      type="password"
                      value={recoveryConfirmPassword}
                      onChange={(e) => setRecoveryConfirmPassword(e.target.value)}
                      placeholder={t("Repeat new password", "Повторите новый пароль")}
                      className="w-full rounded-2xl border border-[#26181d] bg-[#090909] px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-[#ffb7c5]/55"
                    />
                  </label>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={recoverySaving}
                      className="inline-flex w-full items-center justify-center rounded-full bg-[#ffb7c5] px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-black shadow-[0_0_30px_rgba(255,183,197,0.18)] transition hover:bg-[#ffc8d3] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {recoverySaving
                        ? t("Saving password...", "Сохранение пароля...")
                        : t("Save New Password", "Сохранить новый пароль")}
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body
          )
        : null}
    </main>
  );
}

