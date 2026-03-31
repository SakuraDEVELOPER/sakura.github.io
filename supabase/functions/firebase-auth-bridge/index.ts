import { createClient } from "npm:@supabase/supabase-js@2";
import { cert, getApps, initializeApp } from "npm:firebase-admin/app";
import { getAuth } from "npm:firebase-admin/auth";
import { getFirestore } from "npm:firebase-admin/firestore";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const firebaseServiceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON") ?? "";
const firebaseServiceAccountEmail = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_EMAIL") ?? "";
const firebaseServiceAccountPrivateKey = (
  Deno.env.get("FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY") ?? ""
).replace(/\\n/g, "\n");

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error(
    "Missing required env for firebase-auth-bridge function. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
  );
}

if (
  !firebaseServiceAccountJson &&
  (!firebaseServiceAccountEmail || !firebaseServiceAccountPrivateKey)
) {
  throw new Error(
    "Missing Firebase service account env for firebase-auth-bridge. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_EMAIL and FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY."
  );
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

type JsonRecord = Record<string, unknown>;

type ProfileRow = {
  profile_id: number | null;
  firebase_uid: string | null;
  auth_user_id: string | null;
  email: string | null;
  login?: string | null;
  display_name?: string | null;
  email_verified?: boolean | null;
  verification_required?: boolean | null;
  provider_ids?: string[] | null;
  roles?: string[] | null;
  created_at?: string | null;
  last_sign_in_at?: string | null;
};

const LOGIN_MIN_LENGTH = 3;
const LOGIN_MAX_LENGTH = 24;
const PROFILE_SELECT =
  "profile_id,firebase_uid,auth_user_id,email,login,display_name,email_verified,verification_required,provider_ids,roles,created_at,last_sign_in_at";

const json = (body: JsonRecord, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const nowIso = () => new Date().toISOString();

const getBearerToken = (request: Request) => {
  const authorization = request.headers.get("authorization") ?? "";

  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const token = authorization.slice(7).trim();
  return token || null;
};

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

const normalizeStringArray = (value: unknown, maxLength = 64) =>
  Array.isArray(value)
    ? value
        .map((entry) => normalizeString(entry, maxLength))
        .filter((entry): entry is string => Boolean(entry))
    : [];

const normalizeBoolean = (value: unknown) =>
  typeof value === "boolean" ? value : null;

const sanitizeLogin = (value: unknown) =>
  typeof value === "string"
    ? value
        .normalize("NFKC")
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .trim()
        .replace(/\s+/g, "")
        .replace(/[^A-Za-z\u0400-\u04FF0-9._-]/g, "")
        .slice(0, LOGIN_MAX_LENGTH)
    : "";

const normalizeLogin = (value: unknown) => sanitizeLogin(value).toLocaleLowerCase();

const isFirebaseAuthUserNotFoundError = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  String((error as { code?: unknown }).code) === "auth/user-not-found";

const normalizeProviderId = (providerId: string) => {
  const normalizedProviderId = providerId.trim().toLowerCase();

  if (!normalizedProviderId) {
    return null;
  }

  if (normalizedProviderId === "google") {
    return "google.com";
  }

  if (normalizedProviderId === "email") {
    return "password";
  }

  return normalizedProviderId;
};

const hasTrustedEmailProvider = (providerIds: string[]) =>
  providerIds.some((providerId) => providerId === "google.com" || providerId === "google");

const toProfileRow = (data: Record<string, unknown> | null): ProfileRow | null =>
  data
    ? {
        profile_id: normalizeInteger(data.profile_id),
        firebase_uid: normalizeString(data.firebase_uid, 128),
        auth_user_id: normalizeString(data.auth_user_id, 128),
        email: normalizeString(data.email, 320),
        login: normalizeString(data.login, 64),
        display_name: normalizeString(data.display_name, 96),
        email_verified: normalizeBoolean(data.email_verified),
        verification_required: normalizeBoolean(data.verification_required),
        provider_ids: normalizeStringArray(data.provider_ids),
        roles: normalizeStringArray(data.roles),
        created_at: normalizeString(data.created_at, 64),
        last_sign_in_at: normalizeString(data.last_sign_in_at, 64),
      }
    : null;

const parseFirebaseServiceAccount = () => {
  if (firebaseServiceAccountJson) {
    const parsed = JSON.parse(firebaseServiceAccountJson) as Record<string, unknown>;

    return {
      projectId:
        normalizeString(parsed.project_id, 200) ??
        normalizeString(parsed.projectId, 200),
      clientEmail:
        normalizeString(parsed.client_email, 320) ??
        normalizeString(parsed.clientEmail, 320),
      privateKey:
        normalizeString(parsed.private_key, 8192) ??
        normalizeString(parsed.privateKey, 8192),
    };
  }

  return {
    projectId: null,
    clientEmail: firebaseServiceAccountEmail,
    privateKey: firebaseServiceAccountPrivateKey,
  };
};

const getFirebaseAdminAuth = () => {
  if (!getApps().length) {
    const serviceAccount = parseFirebaseServiceAccount();

    if (!serviceAccount.clientEmail || !serviceAccount.privateKey) {
      throw new Error("Firebase service account is missing client email or private key.");
    }

    initializeApp({
      credential: cert({
        projectId: serviceAccount.projectId ?? undefined,
        clientEmail: serviceAccount.clientEmail,
        privateKey: serviceAccount.privateKey,
      }),
    });
  }

  return getAuth();
};

const getFirebaseAdminFirestore = () => {
  if (!getApps().length) {
    getFirebaseAdminAuth();
  }

  return getFirestore();
};

const verifySupabaseAccessToken = async (token: string) => {
  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user?.id) {
    throw new Error("Invalid Supabase session.");
  }

  return data.user;
};

const loadProfileByAuthUserId = async (authUserId: string): Promise<ProfileRow | null> => {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return toProfileRow(data);
};

const loadProfilesByEmail = async (email: string): Promise<ProfileRow[]> => {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("email", email)
    .limit(2);

  if (error) {
    throw error;
  }

  return Array.isArray(data)
    ? data
        .map((row) => toProfileRow(row))
        .filter((row): row is ProfileRow => Boolean(row))
    : [];
};

const linkProfileToSupabaseUser = async (
  profileId: number,
  authUserId: string,
): Promise<ProfileRow | null> => {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({
      auth_user_id: authUserId,
      updated_at: nowIso(),
    })
    .eq("profile_id", profileId)
    .select(PROFILE_SELECT)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return toProfileRow(data);
};

const loadProfileByLogin = async (login: string): Promise<ProfileRow | null> => {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select(PROFILE_SELECT)
    .ilike("login", login)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return toProfileRow(data);
};

const updateProfileCompatibility = async (
  profileId: number,
  updates: Record<string, unknown>,
): Promise<ProfileRow | null> => {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({
      ...updates,
      updated_at: nowIso(),
    })
    .eq("profile_id", profileId)
    .select(PROFILE_SELECT)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return toProfileRow(data);
};

const resolveSupabaseProviderIds = (supabaseUser: {
  app_metadata?: Record<string, unknown> | null;
}) => {
  const appMetadata = supabaseUser.app_metadata ?? {};
  const providerList = [
    ...normalizeStringArray(appMetadata.providers),
    ...(typeof appMetadata.provider === "string" ? [appMetadata.provider] : []),
  ]
    .map((providerId) => normalizeProviderId(providerId))
    .filter((providerId): providerId is string => Boolean(providerId));

  return providerList.length ? [...new Set(providerList)] : ["password"];
};

const resolveSupabaseDisplayName = (supabaseUser: {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}) => {
  const userMetadata = supabaseUser.user_metadata ?? {};

  return (
    normalizeString(userMetadata.display_name, 96) ??
    normalizeString(userMetadata.full_name, 96) ??
    normalizeString(userMetadata.name, 96) ??
    normalizeString(supabaseUser.email, 320)?.split("@")[0]?.slice(0, 96) ??
    "Sakura User"
  );
};

const resolveLoginSeed = (supabaseUser: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}) => {
  const userMetadata = supabaseUser.user_metadata ?? {};
  const requestedLogin =
    sanitizeLogin(userMetadata.login) ||
    sanitizeLogin(userMetadata.requested_login) ||
    sanitizeLogin(userMetadata.display_name) ||
    sanitizeLogin(userMetadata.full_name) ||
    sanitizeLogin(userMetadata.name) ||
    sanitizeLogin(normalizeString(supabaseUser.email, 320)?.split("@")[0] ?? "");

  return requestedLogin || `user${supabaseUser.id.replace(/[^a-z0-9]/gi, "").slice(0, 6)}`;
};

const resolveAvailableLogin = async (supabaseUser: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}) => {
  const baseLogin = sanitizeLogin(resolveLoginSeed(supabaseUser));
  const fallbackLogin = baseLogin || `user${supabaseUser.id.replace(/[^a-z0-9]/gi, "").slice(0, 6)}`;
  let nextLogin = fallbackLogin.slice(0, LOGIN_MAX_LENGTH);
  let nextSuffix = 1;

  while (nextLogin.length < LOGIN_MIN_LENGTH) {
    nextLogin = `${nextLogin || "user"}${nextSuffix}`.slice(0, LOGIN_MAX_LENGTH);
    nextSuffix += 1;
  }

  while (true) {
    const existingProfile = await loadProfileByLogin(nextLogin);

    if (!existingProfile) {
      return nextLogin;
    }

    const suffix = String(nextSuffix);
    const prefix = fallbackLogin.slice(0, Math.max(LOGIN_MIN_LENGTH, LOGIN_MAX_LENGTH - suffix.length));
    nextLogin = `${prefix}${suffix}`.slice(0, LOGIN_MAX_LENGTH);
    nextSuffix += 1;
  }
};

const resolveFirebaseUidForSupabaseUser = async (supabaseUser: {
  id: string;
  email?: string | null;
}) => {
  const email = normalizeString(supabaseUser.email, 320);

  if (email) {
    try {
      const existingUser = await getFirebaseAdminAuth().getUserByEmail(email);

      if (existingUser?.uid) {
        return existingUser.uid;
      }
    } catch (error) {
      if (!isFirebaseAuthUserNotFoundError(error)) {
        throw error;
      }
    }
  }

  return `sb_${supabaseUser.id}`.slice(0, 128);
};

const ensureFirebaseAuthUser = async (
  firebaseUid: string,
  options: {
    email: string | null;
    displayName: string | null;
    emailVerified: boolean;
  },
) => {
  const authAdmin = getFirebaseAdminAuth();

  try {
    await authAdmin.getUser(firebaseUid);
    await authAdmin.updateUser(firebaseUid, {
      email: options.email ?? undefined,
      displayName: options.displayName ?? undefined,
      emailVerified: options.emailVerified,
    });
    return;
  } catch (error) {
    if (!isFirebaseAuthUserNotFoundError(error)) {
      throw error;
    }
  }

  await authAdmin.createUser({
    uid: firebaseUid,
    email: options.email ?? undefined,
    displayName: options.displayName ?? undefined,
    emailVerified: options.emailVerified,
  });
};

const ensureFirebaseFirestoreProfile = async (
  profile: ProfileRow,
  supabaseUser: {
    email?: string | null;
    email_confirmed_at?: string | null;
    confirmed_at?: string | null;
    created_at?: string | null;
    last_sign_in_at?: string | null;
  },
) => {
  if (!profile.firebase_uid || !profile.profile_id || profile.profile_id <= 0) {
    throw new Error("Profile is missing firebase_uid or profile_id.");
  }

  const firestore = getFirebaseAdminFirestore();
  const providerIds = Array.isArray(profile.provider_ids) && profile.provider_ids.length
    ? profile.provider_ids
    : resolveSupabaseProviderIds(supabaseUser);
  const emailVerified =
    profile.email_verified === true ||
    Boolean(
      normalizeString(supabaseUser.email_confirmed_at, 64) ??
      normalizeString(supabaseUser.confirmed_at, 64)
    ) ||
    hasTrustedEmailProvider(providerIds);
  const verificationRequired =
    typeof profile.verification_required === "boolean"
      ? profile.verification_required
      : !emailVerified && !hasTrustedEmailProvider(providerIds);
  const loginHistory = [
    normalizeString(profile.last_sign_in_at ?? supabaseUser.last_sign_in_at, 64),
    normalizeString(profile.created_at ?? supabaseUser.created_at, 64),
  ].filter((entry): entry is string => Boolean(entry));

  await firestore.collection("users").doc(profile.firebase_uid).set(
    {
      uid: profile.firebase_uid,
      authUserId: profile.auth_user_id ?? null,
      email: profile.email ?? normalizeString(supabaseUser.email, 320),
      emailVerified,
      verificationRequired,
      verificationEmailSent: false,
      login: profile.login ?? null,
      loginLower: normalizeLogin(profile.login),
      displayName: profile.display_name ?? resolveSupabaseDisplayName(supabaseUser),
      photoURL: null,
      roles: Array.isArray(profile.roles) && profile.roles.length ? profile.roles : ["user"],
      isBanned: false,
      bannedAt: null,
      providerIds,
      creationTime: profile.created_at ?? normalizeString(supabaseUser.created_at, 64),
      lastSignInTime: profile.last_sign_in_at ?? normalizeString(supabaseUser.last_sign_in_at, 64),
      loginHistory,
      visitHistory: [],
      updatedAt: nowIso(),
      profileId: profile.profile_id,
    },
    { merge: true },
  );

  const countersRef = firestore.collection("meta").doc("counters");
  await firestore.runTransaction(async (transaction) => {
    const countersSnapshot = await transaction.get(countersRef);
    const currentCount =
      countersSnapshot.exists && typeof countersSnapshot.data()?.profileCount === "number"
        ? countersSnapshot.data()?.profileCount
        : 0;

    transaction.set(
      countersRef,
      { profileCount: Math.max(currentCount, profile.profile_id ?? 0) },
      { merge: true },
    );
  });
};

const provisionProfileForSupabaseUser = async (supabaseUser: {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
  created_at?: string | null;
  last_sign_in_at?: string | null;
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
}) => {
  const firebaseUid = await resolveFirebaseUidForSupabaseUser(supabaseUser);
  const providerIds = resolveSupabaseProviderIds(supabaseUser);
  const emailVerified =
    Boolean(
      normalizeString(supabaseUser.email_confirmed_at, 64) ??
      normalizeString(supabaseUser.confirmed_at, 64)
    ) || hasTrustedEmailProvider(providerIds);
  const verificationRequired = !emailVerified && !hasTrustedEmailProvider(providerIds);
  const displayName = resolveSupabaseDisplayName(supabaseUser);
  const email = normalizeString(supabaseUser.email, 320);

  await ensureFirebaseAuthUser(firebaseUid, {
    email,
    displayName,
    emailVerified,
  });

  let linkedProfile = await loadProfileByAuthUserId(supabaseUser.id);

  if (!linkedProfile && email) {
    const matches = await loadProfilesByEmail(email);

    if (matches.length === 1 && matches[0].profile_id && matches[0].profile_id > 0) {
      linkedProfile =
        matches[0].auth_user_id === supabaseUser.id
          ? matches[0]
          : await linkProfileToSupabaseUser(matches[0].profile_id, supabaseUser.id);
    }
  }

  if (linkedProfile?.profile_id && !linkedProfile.firebase_uid) {
    linkedProfile = await updateProfileCompatibility(linkedProfile.profile_id, {
      firebase_uid: firebaseUid,
      email,
      email_verified: emailVerified,
      verification_required: verificationRequired,
      verification_email_sent: false,
      provider_ids: providerIds,
      display_name: linkedProfile.display_name ?? displayName,
      last_sign_in_at: normalizeString(supabaseUser.last_sign_in_at, 64),
    });
  }

  if (!linkedProfile) {
    const login = await resolveAvailableLogin(supabaseUser);
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .insert({
        auth_user_id: supabaseUser.id,
        firebase_uid: firebaseUid,
        email,
        email_verified: emailVerified,
        verification_required: verificationRequired,
        verification_email_sent: false,
        login,
        display_name: displayName,
        photo_url:
          normalizeString(supabaseUser.user_metadata?.avatar_url, 2048) ??
          normalizeString(supabaseUser.user_metadata?.picture, 2048),
        roles: ["user"],
        provider_ids: providerIds,
        created_at: normalizeString(supabaseUser.created_at, 64) ?? nowIso(),
        last_sign_in_at: normalizeString(supabaseUser.last_sign_in_at, 64),
        updated_at: nowIso(),
      })
      .select(PROFILE_SELECT)
      .single();

    if (error) {
      throw error;
    }

    linkedProfile = toProfileRow(data);
  }

  if (!linkedProfile) {
    throw new Error("Supabase profile could not be provisioned.");
  }

  await ensureFirebaseFirestoreProfile(linkedProfile, supabaseUser);

  return linkedProfile;
};

const resolveLinkedProfile = async (supabaseUser: {
  id: string;
  email?: string | null;
}) => {
  const linkedProfile = await loadProfileByAuthUserId(supabaseUser.id);

  if (linkedProfile) {
    return {
      profile: linkedProfile,
      linkedByEmail: false,
      error: null as string | null,
    };
  }

  const email = normalizeString(supabaseUser.email, 320);

  if (!email) {
    return {
      profile: null,
      linkedByEmail: false,
      error: "Supabase user does not have an email to match against profiles.",
    };
  }

  const emailMatches = await loadProfilesByEmail(email);

  if (!emailMatches.length) {
    return {
      profile: null,
      linkedByEmail: false,
      error: "No Supabase profile row matches this auth email yet.",
    };
  }

  if (emailMatches.length > 1) {
    return {
      profile: null,
      linkedByEmail: false,
      error: "Multiple profile rows match this auth email. Manual linking is required.",
    };
  }

  const match = emailMatches[0];

  if (!match.profile_id || match.profile_id <= 0) {
    return {
      profile: null,
      linkedByEmail: false,
      error: "Matched profile row is missing profile_id.",
    };
  }

  if (match.auth_user_id && match.auth_user_id !== supabaseUser.id) {
    return {
      profile: null,
      linkedByEmail: false,
      error: "Matched profile row is already linked to another Supabase auth user.",
    };
  }

  const updatedProfile =
    match.auth_user_id === supabaseUser.id
      ? match
      : await linkProfileToSupabaseUser(match.profile_id, supabaseUser.id);

  return {
    profile: updatedProfile,
    linkedByEmail: true,
    error: null as string | null,
  };
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

    const supabaseUser = await verifySupabaseAccessToken(token);
    const body = ((await request.json().catch(() => ({}))) ?? {}) as JsonRecord;
    const action = normalizeString(body.action, 64) ?? "mint_firebase_custom_token";

    if (action !== "mint_firebase_custom_token") {
      return json({ error: "Unsupported action." }, 400);
    }

    let resolvedProfile = await resolveLinkedProfile({
      id: supabaseUser.id,
      email: supabaseUser.email ?? null,
    });

    if (!resolvedProfile.profile) {
      const provisionedProfile = await provisionProfileForSupabaseUser(supabaseUser);

      resolvedProfile = {
        profile: provisionedProfile,
        linkedByEmail: false,
        error: null,
      };
    }

    if (!resolvedProfile.profile.firebase_uid) {
      const provisionedProfile = await provisionProfileForSupabaseUser(supabaseUser);

      resolvedProfile = {
        profile: provisionedProfile,
        linkedByEmail: resolvedProfile.linkedByEmail,
        error: null,
      };
    }

    const customToken = await getFirebaseAdminAuth().createCustomToken(
      resolvedProfile.profile.firebase_uid,
      {
        supabase_uid: supabaseUser.id,
        supabase_email: supabaseUser.email ?? undefined,
      },
    );

    return json({
      ok: true,
      action,
      customToken,
      firebaseUid: resolvedProfile.profile.firebase_uid,
      profileId: resolvedProfile.profile.profile_id,
      linkedByEmail: resolvedProfile.linkedByEmail,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected firebase-auth-bridge failure.";
    console.error("firebase-auth-bridge failed:", error);
    return json({ error: message }, 500);
  }
});
