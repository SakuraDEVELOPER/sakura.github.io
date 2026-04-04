import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

type FirebaseLookupUser = {
  localId?: unknown;
  email?: unknown;
  emailVerified?: unknown;
  providerUserInfo?: unknown;
};

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers":
    "authorization, x-client-info, apikey, content-type, x-firebase-id-token",
  "access-control-allow-methods": "POST, OPTIONS",
};

const jsonResponse = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "content-type": "application/json; charset=utf-8",
    },
  });

const toOptionalTrimmedString = (value: unknown, maxLength = 2048) =>
  typeof value === "string" && value.trim()
    ? value.trim().slice(0, Math.max(1, Math.trunc(maxLength)))
    : null;

const toOptionalPositiveInteger = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.trunc(value);
  }

  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) && parsedValue > 0 ? Math.trunc(parsedValue) : null;
  }

  return null;
};

const toOptionalTimestamp = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
};

const sanitizeLogin = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[^A-Za-z\u0400-\u04FF0-9._-]/g, "")
    .slice(0, 24);

  return normalized || null;
};

const sanitizeDisplayName = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().replace(/\s+/g, " ").slice(0, 48);
  return normalized || null;
};

const sanitizeRoles = (value: unknown) => {
  if (!Array.isArray(value)) {
    return ["user"];
  }

  const roles = value
    .filter((entry) => typeof entry === "string")
    .map((entry) => entry.trim().slice(0, 64))
    .filter(Boolean);

  return roles.length ? roles : ["user"];
};

const sanitizeProviderIds = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry) => typeof entry === "string")
    .map((entry) => entry.trim().slice(0, 64))
    .filter(Boolean);
};

const extractProviderIdsFromFirebaseLookup = (value: unknown) =>
  Array.isArray(value)
    ? value
        .map((entry) =>
          entry && typeof entry === "object" && "providerId" in entry
            ? toOptionalTrimmedString((entry as { providerId?: unknown }).providerId, 64)
            : null
        )
        .filter((entry): entry is string => Boolean(entry))
    : [];

const readFirebaseAccountByIdToken = async (idToken: string, firebaseWebApiKey: string) => {
  const lookupUrl = new URL("https://identitytoolkit.googleapis.com/v1/accounts:lookup");
  lookupUrl.searchParams.set("key", firebaseWebApiKey);

  const response = await fetch(lookupUrl.toString(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ idToken }),
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json().catch(() => null)) as { users?: FirebaseLookupUser[] } | null;
  const account = Array.isArray(payload?.users) ? payload?.users[0] : null;

  if (!account || typeof account.localId !== "string" || !account.localId.trim()) {
    return null;
  }

  return {
    uid: account.localId.trim(),
    email: toOptionalTrimmedString(account.email, 320),
    emailVerified: account.emailVerified === true,
    providerIds: extractProviderIdsFromFirebaseLookup(account.providerUserInfo),
  };
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse(405, { ok: false, error: "Method not allowed." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const firebaseWebApiKey = Deno.env.get("FIREBASE_WEB_API_KEY") ?? "";

  if (!supabaseUrl || !supabaseServiceRoleKey || !firebaseWebApiKey) {
    return jsonResponse(500, {
      ok: false,
      error: "Function environment is missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or FIREBASE_WEB_API_KEY.",
    });
  }

  const firebaseIdToken = request.headers.get("x-firebase-id-token")?.trim() ?? "";

  if (!firebaseIdToken) {
    return jsonResponse(401, { ok: false, error: "Missing Firebase identity token." });
  }

  const firebaseAccount = await readFirebaseAccountByIdToken(firebaseIdToken, firebaseWebApiKey);

  if (!firebaseAccount) {
    return jsonResponse(401, { ok: false, error: "Invalid Firebase identity token." });
  }

  const requestPayload = (await request.json().catch(() => null)) as
    | { profile?: Record<string, unknown>; source?: unknown }
    | null;
  const profilePayload =
    requestPayload?.profile && typeof requestPayload.profile === "object"
      ? requestPayload.profile
      : {};

  const requestedProfileId = toOptionalPositiveInteger(profilePayload.profileId);
  const source = toOptionalTrimmedString(requestPayload?.source ?? null, 64) ?? "runtime";

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: existingProfile, error: existingProfileError } = await supabase
    .from("profiles")
    .select("profile_id")
    .eq("firebase_uid", firebaseAccount.uid)
    .maybeSingle();

  if (existingProfileError) {
    return jsonResponse(500, {
      ok: false,
      error: "Failed to load existing Supabase profile.",
      details: existingProfileError.message,
    });
  }

  const rowToUpsert: Record<string, unknown> = {
    firebase_uid: firebaseAccount.uid,
    email: firebaseAccount.email ?? toOptionalTrimmedString(profilePayload.email, 320),
    email_verified: firebaseAccount.emailVerified,
    verification_required: profilePayload.verificationRequired === true,
    verification_email_sent: profilePayload.verificationEmailSent === true,
    login: sanitizeLogin(profilePayload.login),
    display_name: sanitizeDisplayName(profilePayload.displayName),
    photo_url: toOptionalTrimmedString(profilePayload.photoURL, 2048),
    avatar_path: toOptionalTrimmedString(profilePayload.avatarPath, 1024),
    avatar_type: toOptionalTrimmedString(profilePayload.avatarType, 64),
    avatar_size: toOptionalPositiveInteger(profilePayload.avatarSize),
    roles: sanitizeRoles(profilePayload.roles),
    provider_ids: firebaseAccount.providerIds.length
      ? firebaseAccount.providerIds
      : sanitizeProviderIds(profilePayload.providerIds),
    last_sign_in_at:
      toOptionalTimestamp(profilePayload.lastSignInTime) ?? new Date().toISOString(),
  };

  const resolvedProfileId =
    toOptionalPositiveInteger(existingProfile?.profile_id) ?? requestedProfileId;

  if (resolvedProfileId !== null) {
    rowToUpsert.profile_id = resolvedProfileId;
  }

  const createdAt = toOptionalTimestamp(profilePayload.creationTime);

  if (!existingProfile?.profile_id && createdAt) {
    rowToUpsert.created_at = createdAt;
  }

  const { data: syncedProfile, error: upsertError } = await supabase
    .from("profiles")
    .upsert(rowToUpsert, {
      onConflict: "firebase_uid",
    })
    .select("firebase_uid, profile_id, login, display_name, email_verified")
    .single();

  if (upsertError) {
    return jsonResponse(500, {
      ok: false,
      error: "Supabase profile upsert failed.",
      details: upsertError.message,
    });
  }

  return jsonResponse(200, {
    ok: true,
    source,
    profile: syncedProfile,
  });
});
