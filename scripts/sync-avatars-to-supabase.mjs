import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { createSign } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

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
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
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
  const res = await fetch("https://oauth2.googleapis.com/token", {
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
  return null;
}

function cleanMediaUrl(raw) {
  if (!raw || typeof raw !== "string") return null;
  return raw
    .replace(/comment-media%0A/g, "comment-media")
    .replace(/comment-media\n/g, "comment-media")
    .replace(/\r?\n/g, "")
    .trim();
}

async function run() {
  console.log("== Syncing Avatars from Firestore to Supabase Profiles ==");
  const token = await getGoogleAccessToken(clientEmail, privateKey);
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users?pageSize=100`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const json = await res.json();

  let updatedCount = 0;
  for (const d of (json.documents || [])) {
    const fields = {};
    for (const [k, v] of Object.entries(d.fields || {})) {
      fields[k] = parseFirestoreValue(v);
    }
    const fbUid = d.name.split("/").pop();
    const photoURL = cleanMediaUrl(fields.photoURL);
    const avatarPath = fields.avatarPath ? String(fields.avatarPath).trim() : null;
    const avatarType = fields.avatarType ? String(fields.avatarType).trim() : null;
    const avatarSize = fields.avatarSize ? Number(fields.avatarSize) : null;

    if (photoURL) {
      console.log(`Found avatar for user ${fields.login || fbUid}: ${photoURL.slice(0, 60)}...`);
      const { error } = await supabase
        .from("profiles")
        .update({
          photo_url: photoURL,
          avatar_path: avatarPath,
          avatar_type: avatarType,
          avatar_size: avatarSize
        })
        .or(`firebase_uid.eq.${fbUid},login.ilike.${fields.login || 'nonexistent'}`);

      if (error) {
        console.warn(`  ! Error updating avatar for ${fields.login}:`, error.message);
      } else {
        updatedCount++;
        console.log(`  ✓ Updated avatar in Supabase profiles for ${fields.login || fbUid}`);
      }
    }
  }

  console.log(`\n✓ Total avatars synced: ${updatedCount}`);
}

run().catch(console.error);
