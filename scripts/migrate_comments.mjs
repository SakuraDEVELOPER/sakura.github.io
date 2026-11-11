import { readFileSync } from "node:fs";
import { createSign } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function loadEnv(filePath) {
  const env = {};
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
    env[key] = val.replace(/\\n/g, "\n");
  }
  return env;
}

const env = loadEnv(".env.local");
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

function cleanUrl(url) {
  if (!url) return null;
  return url.replace(/%0A/gi, "").replace(/[\r\n]+/g, "").trim();
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
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  const encHeader = b64(header);
  const encPayload = b64(payload);
  const signer = createSign("RSA-SHA256");
  signer.update(`${encHeader}.${encPayload}`);
  const signature = signer.sign(privateKey);
  const jwt = `${encHeader}.${encPayload}.${signer ? Buffer.from(signature).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "") : ""}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json();
  return data.access_token;
}

async function migrateComments() {
  const token = await getGoogleAccessToken(env.FIREBASE_SERVICE_ACCOUNT_EMAIL, env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY);
  const res = await fetch(`https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/profileComments`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  const docs = json.documents || [];
  console.log(`Fetched ${docs.length} comments from Firestore.`);

  let inserted = 0;
  for (const doc of docs) {
    const f = doc.fields || {};
    const profileId = f.profileId?.integerValue ? Number(f.profileId.integerValue) : null;
    const authorProfileId = f.authorProfileId?.integerValue ? Number(f.authorProfileId.integerValue) : null;
    const authorUid = f.authorUid?.stringValue || null;
    const authorName = f.authorName?.stringValue || "User";
    const authorPhotoUrl = cleanUrl(f.authorPhotoURL?.stringValue);
    const authorAccentRole = f.authorAccentRole?.stringValue || "user";
    const message = f.message?.stringValue || "";
    const mediaUrl = cleanUrl(f.mediaURL?.stringValue);
    const mediaType = f.mediaType?.stringValue || null;
    const mediaPath = f.mediaPath?.stringValue || null;
    const mediaSize = f.mediaSize?.integerValue ? Number(f.mediaSize.integerValue) : null;
    const createdAt = f.createdAt?.stringValue || doc.createTime || new Date().toISOString();

    if (!profileId) continue;

    const row = {
      profile_id: profileId,
      author_profile_id: authorProfileId,
      firebase_author_uid: authorUid,
      author_name: authorName,
      author_photo_url: authorPhotoUrl,
      author_accent_role: authorAccentRole,
      message,
      media_url: mediaUrl,
      media_type: mediaType,
      media_path: mediaPath,
      media_size: mediaSize,
      created_at: createdAt,
    };

    const { error } = await sb.from("profile_comments").insert(row);
    if (error) {
      console.warn("  ! Insert error:", error.message);
    } else {
      inserted++;
    }
  }

  console.log(`✓ Migrated ${inserted}/${docs.length} comments into Supabase!`);
}

migrateComments().catch(console.error);
