import { createClient } from "npm:@supabase/supabase-js@2";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const firebaseProjectId = Deno.env.get("FIREBASE_PROJECT_ID") ?? "";
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!firebaseProjectId || !supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error(
    "Missing required env for firebase-sync function. Set FIREBASE_PROJECT_ID, SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY."
  );
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const firebaseJwks = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);

type JsonRecord = Record<string, unknown>;

type ActorProfile = {
  profileId: number | null;
  roles: string[];
  authUserId: string | null;
  email: string | null;
  displayName: string | null;
};

const nowIso = () => new Date().toISOString();

const json = (body: JsonRecord, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const normalizeInteger = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? Math.trunc(parsedValue) : null;
  }

  return null;
};

const normalizeString = (value: unknown, maxLength = 500) =>
  typeof value === "string" && value.trim()
    ? value.trim().slice(0, maxLength)
    : null;

const normalizePassword = (value: unknown) =>
  typeof value === "string" && value.length >= 6 && value.length <= 1024
    ? value
    : null;

const normalizeIsoString = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsedValue = Date.parse(value);
  return Number.isFinite(parsedValue) ? new Date(parsedValue).toISOString() : null;
};

const normalizeRoles = (value: unknown) =>
  Array.isArray(value)
    ? value
        .filter((role): role is string => typeof role === "string")
        .map((role) => role.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 16)
    : [];

const normalizeBucketName = (value: unknown) =>
  typeof value === "string" && value.trim()
    ? value.trim().slice(0, 128)
    : "comment-media";

const normalizeStorageObjectPath = (value: unknown) =>
  typeof value === "string" && value.trim()
    ? value.trim().replace(/^\/+/, "").slice(0, 1024)
    : null;

const hasCommentModerationRole = (roles: string[]) =>
  roles.some((role) =>
    [
      "root",
      "co-owner",
      "super administrator",
      "administrator",
      "moderator",
      "support",
    ].includes(role)
  );

const canManageStorageObjects = (roles: string[]) => hasCommentModerationRole(roles);

const getBearerToken = (request: Request) => {
  const authorization = request.headers.get("authorization") ?? "";

  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const token = authorization.slice(7).trim();
  return token || null;
};

const verifyFirebaseIdToken = async (token: string) => {
  const { payload } = await jwtVerify(token, firebaseJwks, {
    issuer: `https://securetoken.google.com/${firebaseProjectId}`,
    audience: firebaseProjectId,
  });

  const uid = typeof payload.sub === "string" && payload.sub ? payload.sub : null;

  if (!uid) {
    throw new Error("Firebase token is missing subject.");
  }

  return {
    uid,
    email: typeof payload.email === "string" ? payload.email : null,
    emailVerified: payload.email_verified === true,
  };
};

const loadActorProfile = async (firebaseUid: string): Promise<ActorProfile> => {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("profile_id,roles,auth_user_id,email,display_name")
    .eq("firebase_uid", firebaseUid)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return {
    profileId: normalizeInteger(data?.profile_id),
    roles: normalizeRoles(data?.roles),
    authUserId: normalizeString(data?.auth_user_id, 128),
    email: normalizeString(data?.email, 320),
    displayName: normalizeString(data?.display_name, 96),
  };
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : typeof error === "object" && error !== null && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : "";

const isAlreadyRegisteredError = (error: unknown) =>
  /already been registered|already registered|user already registered|email.*exists/i.test(
    getErrorMessage(error),
  );

const isMissingAuthUserError = (error: unknown) =>
  /user not found|not found/i.test(getErrorMessage(error));

const authorizeStorageObjectPath = async (
  firebaseUid: string,
  actorProfile: ActorProfile,
  objectPath: string,
) => {
  const normalizedPath = normalizeStorageObjectPath(objectPath);

  if (!normalizedPath) {
    return {
      ok: false,
      error: "Storage object path is required.",
    };
  }

  const pathSegments = normalizedPath.split("/").filter(Boolean);

  if (pathSegments.length < 3) {
    return {
      ok: false,
      error: "Storage object path must include folder, uid, and file name.",
    };
  }

  const folder = pathSegments[0];
  const targetUid = pathSegments[1];
  const isOwner = targetUid === firebaseUid;
  const canModerate = canManageStorageObjects(actorProfile.roles);

  if (!["avatars", "comments"].includes(folder)) {
    return {
      ok: false,
      error: "Storage object path must be inside avatars/ or comments/.",
    };
  }

  if (!isOwner && !canModerate) {
    return {
      ok: false,
      error: "Storage action is not allowed for this actor.",
    };
  }

  return {
    ok: true,
    path: normalizedPath,
  };
};

const handleProfileUpsert = async (firebaseUid: string, body: JsonRecord) => {
  const profile = body.profile;

  if (!profile || typeof profile !== "object") {
    return json({ error: "Missing profile payload." }, 400);
  }

  const profileId = normalizeInteger((profile as JsonRecord).profileId);
  const payloadFirebaseUid = normalizeString((profile as JsonRecord).firebaseUid, 128);

  if (!profileId || profileId <= 0) {
    return json({ error: "Profile id is required." }, 400);
  }

  if (payloadFirebaseUid !== firebaseUid) {
    return json({ error: "Profile owner mismatch." }, 403);
  }

  const row = {
    firebase_uid: firebaseUid,
    profile_id: profileId,
    login: normalizeString((profile as JsonRecord).login, 64),
    display_name: normalizeString((profile as JsonRecord).displayName, 96),
    photo_url: normalizeString((profile as JsonRecord).photoURL, 2048),
    avatar_path: normalizeString((profile as JsonRecord).avatarPath, 512),
    avatar_type: normalizeString((profile as JsonRecord).avatarType, 64),
    avatar_size: normalizeInteger((profile as JsonRecord).avatarSize),
    roles: normalizeRoles((profile as JsonRecord).roles),
    is_banned: (profile as JsonRecord).isBanned === true,
    banned_at: normalizeIsoString((profile as JsonRecord).bannedAt),
    email_verified: (profile as JsonRecord).emailVerified === true,
    verification_required: (profile as JsonRecord).verificationRequired === true,
    created_at: normalizeIsoString((profile as JsonRecord).createdAt),
    last_sign_in_at: normalizeIsoString((profile as JsonRecord).lastSignInTime),
    updated_at: nowIso(),
  };

  const { error } = await supabaseAdmin.from("profiles").upsert(row, {
    onConflict: "profile_id",
  });

  if (error) {
    throw error;
  }

  return json({ ok: true, action: "upsert_profile", profileId });
};

const linkProfileToSupabaseAuthUser = async (
  profileId: number,
  authUserId: string,
  email: string | null,
) => {
  const updates: Record<string, unknown> = {
    auth_user_id: authUserId,
    updated_at: nowIso(),
  };

  if (email) {
    updates.email = email;
  }

  const { error } = await supabaseAdmin
    .from("profiles")
    .update(updates)
    .eq("profile_id", profileId);

  if (error) {
    throw error;
  }
};

const handleEnsureSupabasePasswordUser = async (
  actor: { uid: string; email: string | null; emailVerified: boolean },
  body: JsonRecord,
) => {
  const authPayload = body.auth;

  if (!authPayload || typeof authPayload !== "object") {
    return json({ error: "Missing auth payload." }, 400);
  }

  const actorProfile = await loadActorProfile(actor.uid);
  const requestedEmail = normalizeString((authPayload as JsonRecord).email, 320);
  const email = requestedEmail ?? actor.email ?? actorProfile.email;
  const password = normalizePassword((authPayload as JsonRecord).password);
  const displayName =
    normalizeString((authPayload as JsonRecord).displayName, 96) ?? actorProfile.displayName;

  if (!email) {
    return json({ error: "Email is required." }, 400);
  }

  if (!password) {
    return json({ error: "Password must be at least 6 characters long." }, 400);
  }

  if (actor.email && actor.email !== email) {
    return json({ error: "Supabase auth email must match the Firebase session email." }, 403);
  }

  const userMetadata: Record<string, unknown> = {
    firebase_uid: actor.uid,
  };

  if (displayName) {
    userMetadata.display_name = displayName;
  }

  if (actorProfile.profileId && actorProfile.profileId > 0) {
    userMetadata.profile_id = actorProfile.profileId;
  }

  const authAttributes: Record<string, unknown> = {
    email,
    password,
    user_metadata: userMetadata,
  };

  if (actor.emailVerified) {
    authAttributes.email_confirm = true;
  }

  let authUserId = actorProfile.authUserId;
  let created = false;
  let updated = false;

  if (authUserId) {
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(authUserId, authAttributes);

    if (error) {
      if (!isMissingAuthUserError(error)) {
        throw error;
      }

      authUserId = null;
    } else {
      authUserId = normalizeString(data.user?.id, 128) ?? authUserId;
      updated = true;
    }
  }

  if (!authUserId) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser(authAttributes);

    if (error) {
      if (!isAlreadyRegisteredError(error)) {
        throw error;
      }

      return json({
        ok: true,
        action: "ensure_supabase_password_user",
        created: false,
        updated,
        linked: false,
        authUserId: null,
        existing: true,
      });
    }

    authUserId = normalizeString(data.user?.id, 128);
    created = Boolean(authUserId);
  }

  if (authUserId && actorProfile.profileId && actorProfile.profileId > 0) {
    await linkProfileToSupabaseAuthUser(actorProfile.profileId, authUserId, email);
  }

  return json({
    ok: true,
    action: "ensure_supabase_password_user",
    created,
    updated,
    linked: Boolean(authUserId && actorProfile.profileId && actorProfile.profileId > 0),
    authUserId,
    existing: !created && !updated,
  });
};

const handlePresenceUpsert = async (firebaseUid: string, body: JsonRecord) => {
  const presence = body.presence;

  if (!presence || typeof presence !== "object") {
    return json({ error: "Missing presence payload." }, 400);
  }

  let profileId = normalizeInteger((presence as JsonRecord).profileId);

  if (!profileId || profileId <= 0) {
    const actorProfile = await loadActorProfile(firebaseUid);
    profileId = actorProfile.profileId;
  }

  if (!profileId || profileId <= 0) {
    return json({ error: "Presence profile id is required." }, 400);
  }

  const row = {
    profile_id: profileId,
    firebase_uid: firebaseUid,
    status: (presence as JsonRecord).status === "online" ? "online" : "offline",
    is_online: (presence as JsonRecord).isOnline === true,
    current_path: normalizeString((presence as JsonRecord).currentPath, 512),
    last_seen_at: normalizeIsoString((presence as JsonRecord).lastSeenAt) ?? nowIso(),
    updated_at: nowIso(),
  };

  const { error } = await supabaseAdmin.from("profile_presence").upsert(row, {
    onConflict: "profile_id",
  });

  if (error) {
    throw error;
  }

  return json({ ok: true, action: "upsert_presence", profileId });
};

const handleCommentUpsert = async (firebaseUid: string, body: JsonRecord) => {
  const comment = body.comment;

  if (!comment || typeof comment !== "object") {
    return json({ error: "Missing comment payload." }, 400);
  }

  const commentId = normalizeString((comment as JsonRecord).id, 128);
  const profileId = normalizeInteger((comment as JsonRecord).profileId);
  const authorProfileId = normalizeInteger((comment as JsonRecord).authorProfileId);
  const authorUid = normalizeString((comment as JsonRecord).authorUid, 128);

  if (!commentId || !profileId || profileId <= 0 || !authorUid) {
    return json({ error: "Comment id, profile id, and author uid are required." }, 400);
  }

  const actorProfile = await loadActorProfile(firebaseUid);
  const { data: existingComment, error: existingCommentError } = await supabaseAdmin
    .from("profile_comments")
    .select("id,firebase_author_uid,profile_id")
    .eq("id", commentId)
    .maybeSingle();

  if (existingCommentError) {
    throw existingCommentError;
  }

  const isOwnComment = authorUid === firebaseUid;
  const isExistingOwnComment = existingComment?.firebase_author_uid === firebaseUid;
  const ownsTargetProfile =
    typeof actorProfile.profileId === "number" &&
    actorProfile.profileId > 0 &&
    actorProfile.profileId === normalizeInteger(existingComment?.profile_id ?? profileId);
  const canModerate = hasCommentModerationRole(actorProfile.roles);

  if (existingComment) {
    if (!isExistingOwnComment && !ownsTargetProfile && !canModerate) {
      return json({ error: "Comment update is not allowed for this actor." }, 403);
    }
  } else if (!isOwnComment) {
    return json({ error: "New comment author mismatch." }, 403);
  }

  const row = {
    id: commentId,
    profile_id: profileId,
    author_profile_id: authorProfileId,
    firebase_author_uid: authorUid,
    author_name: normalizeString((comment as JsonRecord).authorName, 96),
    author_photo_url: normalizeString((comment as JsonRecord).authorPhotoURL, 2048),
    author_accent_role: normalizeString((comment as JsonRecord).authorAccentRole, 64),
    message: typeof (comment as JsonRecord).message === "string"
      ? String((comment as JsonRecord).message).slice(0, 280)
      : "",
    media_url: normalizeString((comment as JsonRecord).mediaURL, 4096),
    media_type: normalizeString((comment as JsonRecord).mediaType, 64),
    media_path: normalizeString((comment as JsonRecord).mediaPath, 512),
    media_size: normalizeInteger((comment as JsonRecord).mediaSize),
    created_at: normalizeIsoString((comment as JsonRecord).createdAt) ?? nowIso(),
    updated_at: normalizeIsoString((comment as JsonRecord).updatedAt) ?? nowIso(),
  };

  const { error } = await supabaseAdmin.from("profile_comments").upsert(row, {
    onConflict: "id",
  });

  if (error) {
    throw error;
  }

  return json({ ok: true, action: "upsert_comment", commentId });
};

const handleCommentDelete = async (firebaseUid: string, body: JsonRecord) => {
  const commentId = normalizeString(body.commentId, 128);

  if (!commentId) {
    return json({ error: "Comment id is required." }, 400);
  }

  const actorProfile = await loadActorProfile(firebaseUid);
  const { data: existingComment, error: existingCommentError } = await supabaseAdmin
    .from("profile_comments")
    .select("id,firebase_author_uid,profile_id")
    .eq("id", commentId)
    .maybeSingle();

  if (existingCommentError) {
    throw existingCommentError;
  }

  if (!existingComment) {
    return json({ ok: true, action: "delete_comment", commentId, deleted: false });
  }

  const isAuthor = existingComment.firebase_author_uid === firebaseUid;
  const ownsTargetProfile =
    typeof actorProfile.profileId === "number" &&
    actorProfile.profileId > 0 &&
    actorProfile.profileId === normalizeInteger(existingComment.profile_id);
  const canModerate = hasCommentModerationRole(actorProfile.roles);

  if (!isAuthor && !ownsTargetProfile && !canModerate) {
    return json({ error: "Comment delete is not allowed for this actor." }, 403);
  }

  const { error } = await supabaseAdmin.from("profile_comments").delete().eq("id", commentId);

  if (error) {
    throw error;
  }

  return json({ ok: true, action: "delete_comment", commentId, deleted: true });
};

const handleCreateSignedUploadUrl = async (firebaseUid: string, body: JsonRecord) => {
  const bucket = normalizeBucketName(body.bucket);
  const actorProfile = await loadActorProfile(firebaseUid);
  const authorization = await authorizeStorageObjectPath(
    firebaseUid,
    actorProfile,
    String(body.objectPath ?? ""),
  );

  if (!authorization.ok || !authorization.path) {
    return json({ error: authorization.error ?? "Storage upload is not allowed." }, 403);
  }

  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUploadUrl(authorization.path);

  if (error) {
    throw error;
  }

  return json({
    ok: true,
    action: "create_signed_upload_url",
    bucket,
    path: data?.path ?? authorization.path,
    token: typeof data?.token === "string" ? data.token : null,
  });
};

const handleDeleteStorageObject = async (firebaseUid: string, body: JsonRecord) => {
  const bucket = normalizeBucketName(body.bucket);
  const actorProfile = await loadActorProfile(firebaseUid);
  const authorization = await authorizeStorageObjectPath(
    firebaseUid,
    actorProfile,
    String(body.objectPath ?? ""),
  );

  if (!authorization.ok || !authorization.path) {
    return json({ error: authorization.error ?? "Storage delete is not allowed." }, 403);
  }

  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .remove([authorization.path]);

  if (error) {
    throw error;
  }

  return json({
    ok: true,
    action: "delete_storage_object",
    bucket,
    path: authorization.path,
  });
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  try {
    const token = getBearerToken(request);

    if (!token) {
      return json({ error: "Missing bearer token." }, 401);
    }

    const actor = await verifyFirebaseIdToken(token);
    const body = (await request.json()) as JsonRecord;
    const action = normalizeString(body.action, 64);

    switch (action) {
      case "upsert_profile":
        return await handleProfileUpsert(actor.uid, body);
      case "ensure_supabase_password_user":
        return await handleEnsureSupabasePasswordUser(actor, body);
      case "upsert_presence":
        return await handlePresenceUpsert(actor.uid, body);
      case "upsert_comment":
        return await handleCommentUpsert(actor.uid, body);
      case "delete_comment":
        return await handleCommentDelete(actor.uid, body);
      case "create_signed_upload_url":
        return await handleCreateSignedUploadUrl(actor.uid, body);
      case "delete_storage_object":
        return await handleDeleteStorageObject(actor.uid, body);
      default:
        return json({ error: "Unsupported action." }, 400);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected firebase-sync failure.";
    console.error("firebase-sync failed:", error);
    return json({ error: message }, 500);
  }
});
