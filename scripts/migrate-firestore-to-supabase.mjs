import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { createSign } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const FIRESTORE_SCOPE = "https://www.googleapis.com/auth/datastore";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const raw = readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val.replace(/\\n/g, "\n");
  }
}

loadEnvFile(path.resolve(process.cwd(), ".env.local"));

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_SERVICE_ACCOUNT_EMAIL;
const privateKey = process.env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function getGoogleAccessToken(clientEmail, privateKey) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: clientEmail,
    scope: FIRESTORE_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    iat: issuedAt,
    exp: issuedAt + 3600,
  };
  const unsignedToken = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsignedToken);
  signer.end();
  const signature = signer.sign(privateKey).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  const assertion = `${unsignedToken}.${signature}`;
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await res.json();
  return json.access_token;
}

function parseFirestoreValue(value) {
  if (!value || typeof value !== "object") return null;
  if ("nullValue" in value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("timestampValue" in value) return value.timestampValue;
  if ("mapValue" in value) {
    const fields = value.mapValue?.fields ?? {};
    const result = {};
    for (const [k, v] of Object.entries(fields)) {
      result[k] = parseFirestoreValue(v);
    }
    return result;
  }
  if ("arrayValue" in value) {
    const values = value.arrayValue?.values ?? [];
    return values.map(parseFirestoreValue);
  }
  return null;
}

async function listCollection(token, collName) {
  const docs = [];
  let pageToken = null;
  while (true) {
    const url = new URL(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collName}`);
    url.searchParams.set("pageSize", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await fetch(url.toString(), { headers: { authorization: `Bearer ${token}` } });
    if (!res.ok) {
      console.error(`Failed to list ${collName}:`, res.status, await res.text());
      break;
    }
    const data = await res.json();
    const batch = data.documents || [];
    for (const d of batch) {
      const fields = {};
      for (const [k, v] of Object.entries(d.fields || {})) {
        fields[k] = parseFirestoreValue(v);
      }
      docs.push({ name: d.name.split("/").pop(), fields });
    }
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }
  return docs;
}

function parseIsoTimestamp(val) {
  if (!val || typeof val !== "string") return null;
  const t = Date.parse(val);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

async function migrate() {
  console.log("== Starting Full Firebase -> Supabase Migration ==");
  const token = await getGoogleAccessToken(clientEmail, privateKey);
  console.log("✓ Authenticated with Firebase Admin SDK");

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  console.log("✓ Connected to Supabase client");

  // 1. Promo codes
  console.log("\n[1/2] Migrating Promo Codes...");
  const promos = await listCollection(token, "promoCodes");
  console.log(`Found ${promos.length} promo codes in Firestore`);

  let promoCount = 0;
  for (const p of promos) {
    const f = p.fields;
    const row = {
      code: String(f.code || p.name).trim().toUpperCase(),
      duration_days: Number(f.durationDays) || 30,
      role: String(f.role || "subscriber").trim(),
      is_active: f.isActive !== false,
      max_uses: Number(f.maxUses) || 1,
      used_count: Number(f.usedCount) || 0,
      used_by: Array.isArray(f.usedBy) ? f.usedBy : [],
      created_at: parseIsoTimestamp(f.createdAt) || new Date().toISOString(),
      created_by: String(f.createdBy || "1"),
      note: String(f.note || ""),
    };

    const { error } = await supabase.from("promo_codes").upsert(row, { onConflict: "code" });
    if (error) {
      console.warn(`  ! Warning on promo code ${row.code}:`, error.message);
    } else {
      promoCount++;
      console.log(`  ✓ Synced promo: ${row.code} (${row.duration_days}d, role: ${row.role})`);
    }
  }
  console.log(`✓ Promo codes migrated: ${promoCount}/${promos.length}`);

  // 2. Users and subscriptions
  console.log("\n[2/2] Migrating Users & Subscriptions...");
  const users = await listCollection(token, "users");
  console.log(`Found ${users.length} users in Firestore`);

  let userCount = 0;
  for (const u of users) {
    const f = u.fields;
    const fbUid = u.name;
    const subUntil = parseIsoTimestamp(f.subscriptionUntil || f.subscription_until);
    const roles = Array.isArray(f.roles) ? f.roles.map(r => String(r).trim()).filter(Boolean) : ["user"];
    const login = String(f.login || f.display_name || f.displayName || "").trim() || null;
    const profileId = Number(f.profileId) || null;

    const userUpdate = {
      firebase_uid: fbUid,
      subscription_until: subUntil,
      roles: roles,
      is_banned: f.isBanned === true,
      has_claimed_trial: f.hasClaimedTrial === true,
      trial_claimed_at: parseIsoTimestamp(f.trialClaimedAt),
      is_frozen: f.isFrozen === true,
      frozen_at: parseIsoTimestamp(f.frozenAt),
      last_frozen_at: parseIsoTimestamp(f.lastFrozenAt),
      frozen_remaining_ms: Number(f.frozenRemainingMs) || 0,
      activation_history: Array.isArray(f.activationHistory) ? f.activationHistory : [],
      hwid: f.hwid ? String(f.hwid).trim() : null,
    };

    if (login) userUpdate.login = login;
    if (f.displayName) userUpdate.display_name = String(f.displayName).trim();
    if (f.email) userUpdate.email = String(f.email).trim().toLowerCase();

    // Check if profile exists by firebase_uid or profile_id or login
    let matchQuery = supabase.from("profiles").select("id, profile_id, firebase_uid, login, roles");
    if (fbUid) {
      matchQuery = matchQuery.eq("firebase_uid", fbUid);
    } else if (profileId) {
      matchQuery = matchQuery.eq("profile_id", profileId);
    } else if (login) {
      matchQuery = matchQuery.eq("login", login);
    }

    const { data: existing } = await matchQuery.maybeSingle();

    if (existing) {
      // Merge roles so no permissions are lost
      const mergedRoles = Array.from(new Set([...(existing.roles || []), ...roles]));
      userUpdate.roles = mergedRoles;

      const { error } = await supabase.from("profiles").update(userUpdate).eq("id", existing.id);
      if (error) {
        console.warn(`  ! Error updating user ${login || fbUid}:`, error.message);
      } else {
        userCount++;
        console.log(`  ✓ Updated profile #${existing.profile_id} (${login || fbUid}): roles=${JSON.stringify(mergedRoles)}, subUntil=${subUntil || 'none'}`);
      }
    } else {
      // Insert new profile with next available profile_id
      const { data: maxRow } = await supabase.from("profiles").select("profile_id").order("profile_id", { ascending: false }).limit(1);
      const nextId = (maxRow?.[0]?.profile_id || 14) + 1;
      const { error } = await supabase.from("profiles").insert({
        ...userUpdate,
        profile_id: nextId,
        created_at: parseIsoTimestamp(f.creationTime) || new Date().toISOString(),
      });
      if (error) {
        console.warn(`  ! Error creating user ${login || fbUid}:`, error.message);
      } else {
        userCount++;
        console.log(`  ✓ Created new profile #${nextId} for ${login || fbUid}`);
      }
    }
  }

  console.log(`✓ Users migrated: ${userCount}/${users.length}`);
  console.log("\n== Migration Finished Successfully ==");
}

migrate().catch(console.error);
