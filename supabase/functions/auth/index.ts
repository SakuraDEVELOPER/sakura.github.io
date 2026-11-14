import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
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

const FIREBASE_API_KEY = "AIzaSyAnZQt5NWXGOWuz3STh_vy-dSENVBM9_ZY";
const JWT_SECRET = Deno.env.get("JWT_SECRET") || "sakura-auth-secret-2026";

const PAYLOAD_KEYS: Record<string, { key: string; cipher_sha256: string }> = {
  "0b7a0076fbfa46f0b27c81679c7bbb9e": {
    key: "887ba4a5178bb3355ec493d894423ae6fb2d972e20ef27ddd78438a2625fe155",
    cipher_sha256: "14bd92cc3c9fc8e116c596b3394f98ce1d5f8cdb3685497ceaa898d4c8d37773",
  },
  "26dd238b75c24d5ba195b15369ab5180": {
    key: "39d412370f50853b6051187e2b3d03d8a33dee30ab8cf3ec6e254de1873af8a9",
    cipher_sha256: "7abb809c0668b8d523aa48074f1195dfa84368841181df0cf67e576bcc1144de",
  },
  "5ff8ed3945524599b4507e107d5d6748": {
    key: "2a9335ee23fba008b431de81e4f219c72031c29a691f896523bf464094eedd6a",
    cipher_sha256: "b7ce0e1160cf4b1533ddea80a3df8f01017b3f10c00949617791a00fd910aaa7",
  },
  "bc3ec3dfc8ef4c75b8dda19ef7db99e1": {
    key: "f00a7e0325ff0e0c1bfd23ddd47bed6882272f8e6015ec2c702d76e893de392f",
    cipher_sha256: "374e44c97e7e90819fde0590c36eeb8cde6056b141ddbede4068c03bbf67df86",
  },
  "f91a149d09bc456d955a177e5b21a5fc": {
    key: "5368efecbfcdc48b53cd5566bba0b268ae823faab7a6f53afdb16bfeaa7b30a1",
    cipher_sha256: "a1da6d2e77d7a3d1e7856a8ef4e7393063eb5d6566442b10a397bd3342740972",
  },
  "69d60af1e41246b2b214bfeae3520d65": {
    key: "f8b858ce84c16c59ee9a875ac21f04419bfa0e58045176002e797bce43ea350c",
    cipher_sha256: "a80ab768867382fea321a34cd566022e4b353f34b26289d7e58f821e38713e20",
  },
  "7d2b9be8f3bc4e3f8f02bb84c3f7a627": {
    key: "9c94361117e0c44d3ce839031f89348a2f31de4b7eb2739603cc06bf8336fd53",
    cipher_sha256: "d27d0b5b0bda4997a1745c666eb9f537998a064f51610bede509dd62a677e650",
  },
  "d9bee3affde44d498e463ae7742000e0": {
    key: "db4f56d5560bef112b1c84284ea4afd42ed5953da5842c55604707c22994da22",
    cipher_sha256: "a3d9e5adfbc02b7a5a2f76223d95f0904cd948898717a3520d0ca8c98c9c4527",
  },
  "0a8fd37b499d4fe79786fafa850b8a85": {
    key: "c8c8ead10071e286bc2843ef771f488ed7007e96b862bff484f17800a19dd521",
    cipher_sha256: "8b50aeb64a84206bf1bda4877a5c0753779d1ce630779aa1fe761ee694a60515",
  },
  "3ec0a3c57b1741e8beed6efac056fba6": {
    key: "e5919e3fe957100101cff734e184bccafbffbc9f46fd0e116218144699125349",
    cipher_sha256: "6d4caa5635b46441fd74554e92ec4703564a96343bafb226db394dd80457694b",
  },
  "41dc9d714977447481202081f7a1bdec": {
    key: "d4576f4abc3074fbbb2691c1a56ebc565da6a57e6e370aee5794089bd5ab0dc3",
    cipher_sha256: "68c2ba08e4f5b432ad5d69f5982628b6d1f2a10f07eb0145f19c8cc140329280",
  },
  "91de1156d4cd49a9bb3e81fbb7f1dd27": {
    key: "2517da238a9358595ec4aed2ac6fde95c12f98158eacfb4467125b23cabd6f69",
    cipher_sha256: "e3e8275ba59383dd051b0022b2dcc7ac40fe650ba0aacfa3f54f31737df49cbc",
  },
  "22fb0b1aff6a4877901eee8beeccef68": {
    key: "896f5b95d60403829e74791ececd5c816554261dbd1af606cb43ce1da0ba2edf",
    cipher_sha256: "d4f18146ae089d30e44e9bfdeda6b89ab20c72b527b1e15b419ac8e34af4b9e2",
  },
  "2b18cfc4fc93402baee7ac475c38688c": {
    key: "789bf5b232d79f692a76265f0a505a2647584d643773af507657f064817252a6",
    cipher_sha256: "63c01403a6fc85a6adb467f0b8095c029cd02d270bebb0a5bcf67a47a5cde8c0",
  },
  "85c83676ec9a467cb1c60fbb5a78f50d": {
    key: "e6b0a0053deb2d10fa0cfbc86d7ff3248aeef984f99d78e1c8960da3dc8fbe7f",
    cipher_sha256: "73be7aef7130fd2a3c7382957e59449db7728a35b18767f8d519c9465626139d",
  },
  "9b1f8ce69ab94644b15d3d734da57389": {
    key: "f0ed3bbbb38b9a69d351c6bb5df1edf3efef9b1d0a00a2326cec17b23ccceae9",
    cipher_sha256: "aa2b2bd1020ebcb2f2f13f4de61db80266793ab94d34df83a9cb6e3b8975d081",
  },
  "e3b413e7162b44fb9ad01a77bc3f2a34": {
    key: "35ab906414e3e4fe45767c97c22c8a92b7c3fdfb4460978c74a2ba892f473157",
    cipher_sha256: "d8aa4ee5a802cf893b9f423b3b2f23b121fe4f8bc93d9547b973c0c5e18cf661",
  },
  "d7b7d579af4141b2ba3996978eb02fab": {
    key: "2c7cc6f679365e85e3af21e64fee08c0ac31389c2e128ae139aed72bf1635b30",
    cipher_sha256: "3806174397d2137b7de8a1d0d5edcab5ffa4e5ea22c84af61faf5b0177ad44a6",
  },
  "a39db69c2b504d74886cf13d648e8e8c": {
    key: "b2177b1693b4ac253da61c3256404a9e1238b0ee1f999f0fdeb05dfaba5ad74c",
    cipher_sha256: "2661ee907f3295b027d2820294b01542ad3cdf5082e1f5af87c5bc3c69d3e0ba",
  },
  "92a17dae1a8a45d8a8a8824f82cb82fa": {
    key: "e5176b931425aa583da3d982c108b8a9e89614596a31c3f29c36e05e1134e176",
    cipher_sha256: "9732d3a28700d139f3d49920c82883b4e68228790d985cd424716c809557d5e5",
  },
  "c5f56c7bdaeb40b0b91496914f6b8d1c": {
    key: "ded6bb87802f3881d611bae8f8ef05e91235b65cf10d1896ef18e8a5eb81c403",
    cipher_sha256: "c5b62e273de9284d6ae2580d4d5546237bb26c926610985cf990370ea995f402",
  },
  "5257f35eedc042768b2c9cc014434b22": {
    key: "002f098d152774731ca4c40b71de19651b494ec2456c2524c56bb4ad1661be67",
    cipher_sha256: "a4d17dc36d897c388da86c07a18c10dafacb3afa3dfc92042ea201c56e3ec104",
  },
  "29383159fc0445eea2ccbe9d66622f88": {
    key: "757de6dce2566d15f4d7cb08ccdf055e9c0e6ff09d43701b1dc4d8a9d521bfeb",
    cipher_sha256: "ebf78dcac0cb0a96147a33cfe8ec35d59bd0f7b827be5ae0065e30fb61fda6eb",
  },
};

// ECDSA P-256 Private Key (PKCS#8 PEM)
const PRIVATE_KEY_PEM = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgQ38Kx+5yMvyFv4T9
yVOZv2HnrkGMUa/9VPpXyOh+pCOhRANCAASX0JDuqL8R3GDvh0Qx7n08UoO+KnKJ
FkoJJMSK9SvlgtQRJVk5uMAuyD0qb+v99qo7noEB/IC/eoswLqjrJmnu
-----END PRIVATE KEY-----`;

function pemToBinary(pem: string): Uint8Array {
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const binStr = atob(b64);
  const len = binStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binStr.charCodeAt(i);
  }
  return bytes;
}

let cachedSigningKey: CryptoKey | null = null;
async function getSigningKey(): Promise<CryptoKey> {
  if (cachedSigningKey) return cachedSigningKey;
  const der = pemToBinary(PRIVATE_KEY_PEM);
  cachedSigningKey = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  return cachedSigningKey;
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuf = await crypto.subtle.digest("SHA-256", data);
  const hashArr = Array.from(new Uint8Array(hashBuf));
  return hashArr.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function base64Encode(bytes: Uint8Array): string {
  let binStr = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binStr += String.fromCharCode(bytes[i]);
  }
  return btoa(binStr);
}

// Compact token without dots, spaces or invalid characters for Windows strspn/strlen<=256
async function createToken(profileId: number, login: string, hwid = ""): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  const safeLogin = login.replace(/[^A-Za-z0-9_-]/g, "");
  const safeHwid = hwid.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
  const data = safeHwid ? `${profileId}_${safeLogin}_${iat}_${safeHwid}` : `${profileId}_${safeLogin}_${iat}`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(JWT_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  const sigHex = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
  return `${data}_${sigHex}`;
}

async function verifyToken(token: string): Promise<{ profile_id: number; login: string; hwid: string } | null> {
  try {
    if (!token || token.length > 256) return null;
    const parts = token.split("_");
    if (parts.length !== 4 && parts.length !== 5) return null;

    let profileIdStr = "";
    let login = "";
    let iatStr = "";
    let hwid = "";
    let sigHex = "";

    if (parts.length === 5) {
      [profileIdStr, login, iatStr, hwid, sigHex] = parts;
    } else {
      [profileIdStr, login, iatStr, sigHex] = parts;
    }

    const profileId = Number(profileIdStr);
    const iat = Number(iatStr);
    if (!Number.isFinite(profileId) || !Number.isFinite(iat)) return null;
    if (Date.now() / 1000 > iat + 30 * 86400) return null;

    const data = hwid ? `${profileId}_${login}_${iat}_${hwid}` : `${profileId}_${login}_${iat}`;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(JWT_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(data));
    const expectedSigHex = Array.from(new Uint8Array(sigBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 32);

    if (sigHex !== expectedSigHex) return null;
    return { profile_id: profileId, login, hwid };
  } catch {
    return null;
  }
}

const SUBSCRIBED_ROLES = new Set([
  "subscriber",
  "sub",
  "test period",
  "trial",
  "admin",
  "root",
  "owner",
  "co-owner",
  "lifetime",
  "sponsor",
  "support",
  "tester",
]);

function checkHasSubscription(roles: string[]): boolean {
  return roles.some((r) => SUBSCRIBED_ROLES.has(r.toLowerCase().trim()));
}

function determinePlan(roles: string[]): string {
  const premRoles = ["subscriber", "sub", "admin", "root", "owner", "co-owner", "lifetime", "sponsor"];
  return roles.some((r) => premRoles.includes(r.toLowerCase().trim())) ? "prem" : "trial";
}

async function getLiveProfileInfo(profileId?: number | null, supabaseClient?: any): Promise<{
  subscriptionUntil: string | null;
  roles: string[];
  login: string | null;
  isFrozen: boolean;
}> {
  if (!profileId || !supabaseClient) {
    return { subscriptionUntil: null, roles: [], login: null, isFrozen: false };
  }
  try {
    const { data: p } = await supabaseClient
      .from("profiles")
      .select("subscription_until, roles, login, is_frozen")
      .eq("profile_id", profileId)
      .maybeSingle();

    return {
      subscriptionUntil: p?.subscription_until || null,
      roles: Array.isArray(p?.roles) ? p.roles : [],
      login: p?.login || null,
      isFrozen: Boolean(p?.is_frozen),
    };
  } catch {
    return { subscriptionUntil: null, roles: [], login: null, isFrozen: false };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/auth/, "");

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // 1. LOGIN ROUTE (/login or /v1/login)
    if (path.endsWith("/login") || path.endsWith("/v1/login")) {
      const body = await req.json().catch(() => ({}));
      const identifier = String(body.login || "").trim();
      const password = String(body.password || "");
      const hwid = String(body.hwid || "");

      if (!identifier || !password) {
        return jsonResponse(400, { code: "BAD_INPUT" });
      }

      // Resolve email if username was provided
      let email = identifier;
      if (!identifier.includes("@")) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("email")
          .ilike("login", identifier)
          .maybeSingle();

        if (profile?.email) {
          email = profile.email;
        } else {
          return jsonResponse(401, { code: "INVALID_CREDENTIALS" });
        }
      }

      // Authenticate with Firebase Auth
      const firebaseRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, returnSecureToken: true }),
        }
      );

      const firebaseData = await firebaseRes.json();
      if (!firebaseRes.ok || !firebaseData.localId) {
        return jsonResponse(401, { code: "INVALID_CREDENTIALS" });
      }

      // Query profile from Supabase
      const { data: userProfile, error: profileErr } = await supabase
        .from("profiles")
        .select("profile_id, login, email, roles, is_banned")
        .eq("firebase_uid", firebaseData.localId)
        .maybeSingle();

      if (profileErr || !userProfile) {
        return jsonResponse(404, { code: "USER_NOT_FOUND" });
      }

      if (userProfile.is_banned) {
        return jsonResponse(403, { code: "BANNED" });
      }

      const roles = Array.isArray(userProfile.roles)
        ? userProfile.roles.map((r: string) => r.toLowerCase().trim())
        : [];

      if (!checkHasSubscription(roles)) {
        return jsonResponse(403, { code: "NO_SUBSCRIPTION" });
      }

      const token = await createToken(userProfile.profile_id, userProfile.login || identifier, hwid);

      return jsonResponse(200, {
        token,
        account: String(userProfile.profile_id),
        login: userProfile.login || identifier,
      });
    }

    // 2. DEVICE REMEMBER ROUTE (/device/remember or /v1/device/remember)
    if (path.endsWith("/device/remember") || path.endsWith("/v1/device/remember")) {
      const authHeader = req.headers.get("authorization") || "";
      const token = authHeader.replace(/^Bearer\s+/i, "").trim();
      const session = await verifyToken(token);
      if (!session) {
        return jsonResponse(401, { code: "UNAUTHORIZED" });
      }
      return jsonResponse(200, { refresh: token });
    }

    // 3. DEVICE FORGET ROUTE (/device/forget or /v1/device/forget)
    if (path.endsWith("/device/forget") || path.endsWith("/v1/device/forget")) {
      return jsonResponse(200, { status: "ok" });
    }

    // 4. DEVICE RESUME ROUTE (/device/resume or /v1/device/resume)
    if (path.endsWith("/device/resume") || path.endsWith("/v1/device/resume")) {
      const body = await req.json().catch(() => ({}));
      const refreshToken = String(body.refresh || "").trim();
      const session = await verifyToken(refreshToken);
      if (!session) {
        return jsonResponse(401, { code: "UNAUTHORIZED" });
      }

      const { data: userProfile } = await supabase
        .from("profiles")
        .select("profile_id, login, roles, is_banned")
        .eq("profile_id", session.profile_id)
        .maybeSingle();

      if (!userProfile || userProfile.is_banned) {
        return jsonResponse(403, { code: "BANNED" });
      }

      const roles = Array.isArray(userProfile.roles)
        ? userProfile.roles.map((r: string) => r.toLowerCase().trim())
        : [];

      if (!checkHasSubscription(roles)) {
        return jsonResponse(403, { code: "NO_SUBSCRIPTION" });
      }

      const newToken = await createToken(userProfile.profile_id, userProfile.login || session.login, session.hwid);

      return jsonResponse(200, {
        token: newToken,
        steam: "0",
        login: userProfile.login || session.login,
        account: String(userProfile.profile_id),
      });
    }

    // 5. SDK TICKET ROUTE (/sdk-ticket or /v1/sdk-ticket)
    if (path.endsWith("/sdk-ticket") || path.endsWith("/v1/sdk-ticket")) {
      const authHeader = req.headers.get("authorization") || "";
      const token = authHeader.replace(/^Bearer\s+/i, "").trim();
      const session = await verifyToken(token);
      if (!session) {
        return jsonResponse(401, { code: "UNAUTHORIZED" });
      }
      const body = await req.json().catch(() => ({}));
      const hwid = String(body.hwid || session.hwid || "").trim();

      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("roles, is_banned, login, firebase_uid")
        .eq("profile_id", session.profile_id)
        .maybeSingle();

      const live = await getLiveProfileInfo(currentProfile?.firebase_uid);
      const combinedRoles = Array.from(new Set([...(currentProfile?.roles || []), ...live.roles]));
      const now = Math.floor(Date.now() / 1000);
      const isLifetime = combinedRoles.includes("lifetime") ||
        (live.subscriptionUntil && new Date(live.subscriptionUntil).getFullYear() >= 2099);

      let subexp = now + 30 * 86400;
      if (isLifetime) {
        subexp = now + 3650 * 86400;
      } else if (live.subscriptionUntil) {
        const untilSec = Math.floor(new Date(live.subscriptionUntil).getTime() / 1000);
        if (untilSec > now) {
          subexp = untilSec;
        }
      }
      const resolvedLogin = body.login || live.login || currentProfile?.login || session.login;

      return jsonResponse(200, {
        token,
        hwid,
        steam: "0",
        status: "ok",
        login: resolvedLogin,
        subexp,
      });
    }

    // 5.5. PAYLOAD KEY ROUTE (/payload-key or /v1/payload-key)
    if (path.endsWith("/payload-key") || path.endsWith("/v1/payload-key")) {
      const authHeader = req.headers.get("authorization") || "";
      const token = authHeader.replace(/^Bearer\s+/i, "").trim();
      const session = await verifyToken(token);
      if (!session) {
        return jsonResponse(401, { code: "UNAUTHORIZED" });
      }

      const body = await req.json().catch(() => ({}));
      const id = String(body.id || "").trim();
      const hwid = String(body.hwid || session.hwid || "").trim();
      const steam = String(body.steam || "0").trim();
      const nonce = String(body.nonce || "").trim();

      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("roles, is_banned, login, firebase_uid")
        .eq("profile_id", session.profile_id)
        .maybeSingle();

      if (!currentProfile || currentProfile.is_banned) {
        return jsonResponse(403, { code: "BANNED" });
      }

      const live = await getLiveProfileInfo(currentProfile.firebase_uid);
      const combinedRoles = Array.from(new Set([...(currentProfile.roles || []), ...live.roles]));

      if (!checkHasSubscription(combinedRoles)) {
        return jsonResponse(403, { code: "NO_SUBSCRIPTION" });
      }

      const artifact = PAYLOAD_KEYS[id];
      if (!artifact) {
        return jsonResponse(404, { code: "PACKAGE_UNAVAILABLE" });
      }

      const now = Math.floor(Date.now() / 1000);
      const isLifetime = combinedRoles.includes("lifetime") ||
        (live.subscriptionUntil && new Date(live.subscriptionUntil).getFullYear() >= 2099);

      let subexp = now + 30 * 86400;
      if (isLifetime) {
        subexp = now + 3650 * 86400;
      } else if (live.subscriptionUntil) {
        const untilSec = Math.floor(new Date(live.subscriptionUntil).getTime() / 1000);
        if (untilSec > now) {
          subexp = untilSec;
        }
      }
      const sid = await sha256Hex(token);
      const resolvedLogin = live.login || currentProfile.login || session.login;

      const claims = {
        iss: "guard-sakura-v1",
        aud: "loader",
        sid,
        sub: String(session.profile_id),
        login: resolvedLogin,
        plan: determinePlan(combinedRoles),
        hwid,
        steam: steam || "0",
        nonce,
        iat: now,
        exp: now + 30,
        subexp,
        kind: "payload-key",
        artifact: id,
        cipher_sha256: artifact.cipher_sha256,
        key: artifact.key,
      };

      const payloadJson = JSON.stringify(claims);
      const payloadBytes = new TextEncoder().encode(payloadJson);
      const payloadB64 = base64Encode(payloadBytes);

      const signingKey = await getSigningKey();
      const sigBuf = await crypto.subtle.sign(
        { name: "ECDSA", hash: "SHA-256" },
        signingKey,
        payloadBytes
      );
      const sigB64 = base64Encode(new Uint8Array(sigBuf));

      return jsonResponse(200, {
        payload: payloadB64,
        signature: sigB64,
      });
    }

    // 6. LEASE ROUTE (/loader-lease, /v1/loader-lease, /lease, /v1/lease)
    if (
      path.endsWith("/loader-lease") ||
      path.endsWith("/v1/loader-lease") ||
      path.endsWith("/lease") ||
      path.endsWith("/v1/lease")
    ) {
      const authHeader = req.headers.get("authorization") || "";
      const token = authHeader.replace(/^Bearer\s+/i, "").trim();
      const session = await verifyToken(token);

      if (!session) {
        return jsonResponse(401, { code: "UNAUTHORIZED" });
      }

      const body = await req.json().catch(() => ({}));
      const hwid = String(body.hwid || "").trim();
      const steam = String(body.steam || "0").trim();
      const nonce = String(body.nonce || "").trim();

      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("profile_id, roles, is_banned, login, subscription_until, is_frozen")
        .eq("profile_id", session.profile_id)
        .maybeSingle();

      if (!currentProfile || currentProfile.is_banned) {
        return jsonResponse(403, { code: "BANNED" });
      }

      if (currentProfile.is_frozen) {
        return jsonResponse(403, { code: "FROZEN", message: "Подписка заморожена" });
      }

      const combinedRoles = Array.isArray(currentProfile.roles) ? currentProfile.roles : [];

      if (!checkHasSubscription(combinedRoles)) {
        return jsonResponse(403, { code: "NO_SUBSCRIPTION" });
      }

      const isSdk = path.includes("/v1/lease") || path.endsWith("/lease");
      const now = Math.floor(Date.now() / 1000);
      const isLifetime = combinedRoles.includes("lifetime") ||
        (currentProfile.subscription_until && new Date(currentProfile.subscription_until).getFullYear() >= 2099);

      let subexp = now + 30 * 86400; // default 30 days
      if (isLifetime) {
        subexp = now + 3650 * 86400; // 10 years (3650 days) for Lifetime
      } else if (currentProfile.subscription_until) {
        const untilSec = Math.floor(new Date(currentProfile.subscription_until).getTime() / 1000);
        if (untilSec > now) {
          subexp = untilSec;
        }
      }
      const sid = await sha256Hex(token);
      const resolvedLogin = currentProfile.login || session.login;

      const leaseObj = {
        iss: "guard-sakura-v1",
        aud: isSdk ? "sdk" : "loader",
        nonce,
        hwid,
        steam: steam || "0",
        sid,
        plan: determinePlan(combinedRoles),
        iat: now,
        exp: now + 60, // 60 seconds lease validity (VM strictly requires exp - iat <= 90)
        subexp,
        sub: String(session.profile_id),
        login: resolvedLogin,
      };

      const payloadJson = JSON.stringify(leaseObj);
      const payloadBytes = new TextEncoder().encode(payloadJson);
      const payloadB64 = base64Encode(payloadBytes);

      // Sign with ECDSA P-256 (produces IEEE P1363 64-byte raw signature)
      const signingKey = await getSigningKey();
      const sigBuf = await crypto.subtle.sign(
        { name: "ECDSA", hash: "SHA-256" },
        signingKey,
        payloadBytes
      );
      const sigB64 = base64Encode(new Uint8Array(sigBuf));

      return jsonResponse(200, {
        payload: payloadB64,
        signature: sigB64,
      });
    }

    // 7. GAME BIND ROUTE (/game/bind or /v1/game/bind)
    if (path.endsWith("/bind") || path.endsWith("/game/bind")) {
      return jsonResponse(200, { status: "ok" });
    }

    // 8. STATS ROUTE (/game/stats or /v1/game/stats)
    if (path.endsWith("/stats") || path.endsWith("/game/stats")) {
      return jsonResponse(200, { status: "ok" });
    }

    // 9. LOGOUT ROUTE (/logout or /v1/logout)
    if (path.endsWith("/logout") || path.endsWith("/v1/logout")) {
      return jsonResponse(200, { status: "ok" });
    }

    // 10. SUPPORT NOTIFICATION ROUTE (/support-notify or /v1/support-notify)
    if (path.endsWith("/support-notify") || path.endsWith("/v1/support-notify")) {
      if (req.method !== "POST") {
        return jsonResponse(405, { code: "METHOD_NOT_ALLOWED" });
      }

      const body = await req.json().catch(() => ({}));
      const ticketId = String(body.ticketId || "").slice(0, 32);
      const category = String(body.category || "other").slice(0, 32);
      const authorLogin = String(body.authorLogin || "Guest").slice(0, 64);
      const authorProfileId = String(body.authorProfileId || "?").slice(0, 16);
      const contact = String(body.contact || "Не указан").slice(0, 128);
      let messageText = String(body.message || "").slice(0, 2000);

      // Security: Strip dangerous mentions from message to prevent Discord abuse
      messageText = messageText.replace(/@(everyone|here)/gi, "@\u200B$1");

      const categoryNames: Record<string, string> = {
        payment: "Оплата / Промокоды",
        loader: "Запуск / SakuraLoader",
        cheat: "Чит / Функции",
        other: "Общий вопрос",
      };

      const discordWebhook = Deno.env.get("DISCORD_WEBHOOK_URL") || "";
      if (discordWebhook && discordWebhook.startsWith("https://discord.com/api/webhooks/")) {
        const payload = {
          username: "Sakura Support Bot",
          avatar_url: "https://sakuradeveloper.github.io/favicon.ico",
          embeds: [
            {
              title: `🌸 Новый тикет #${ticketId.slice(-6)} [${categoryNames[category] || category}]`,
              description: messageText || "Без текста",
              color: 0xffb7c5,
              fields: [
                {
                  name: "Пользователь",
                  value: `@${authorLogin} (ID #${authorProfileId})`,
                  inline: true,
                },
                {
                  name: "Контакт для связи",
                  value: contact,
                  inline: true,
                },
                {
                  name: "Статус",
                  value: "Открыт",
                  inline: true,
                },
              ],
              footer: {
                text: "Sakura Cheat Support System • " + new Date().toISOString().slice(0, 19).replace("T", " "),
              },
            },
          ],
        };

        try {
          await fetch(discordWebhook, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
        } catch (webhookErr) {
          console.error("Failed to forward support ticket to Discord:", webhookErr);
        }
      }

      return jsonResponse(200, { status: "ok" });
    }

    // 11. PROMO REDEMPTION ROUTE (/promo, /v1/promo)
    if (path.endsWith("/promo") || path.endsWith("/v1/promo")) {
      if (req.method !== "POST") {
        return jsonResponse(405, { code: "METHOD_NOT_ALLOWED" });
      }

      const authHeader = req.headers.get("authorization") || "";
      const token = authHeader.replace(/^Bearer\s+/i, "").trim();
      const session = await verifyToken(token);

      if (!session) {
        return jsonResponse(401, { code: "UNAUTHORIZED" });
      }

      const body = await req.json().catch(() => ({}));
      const inputCode = String(body.code || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");

      if (!inputCode) {
        return jsonResponse(400, { code: "EMPTY_CODE", message: "Введите промокод" });
      }

      // 1. Fetch user's current profile from Supabase
      const { data: currentProfile, error: profileErr } = await supabase
        .from("profiles")
        .select("profile_id, login, roles, is_banned, subscription_until, activation_history")
        .eq("profile_id", session.profile_id)
        .maybeSingle();

      if (profileErr || !currentProfile) {
        return jsonResponse(404, { code: "USER_NOT_FOUND" });
      }

      if (currentProfile.is_banned) {
        return jsonResponse(403, { code: "BANNED" });
      }

      // 2. Fetch promo code from Supabase promo_codes table
      const { data: promo, error: promoErr } = await supabase
        .from("promo_codes")
        .select("*")
        .ilike("code", inputCode)
        .maybeSingle();

      if (promoErr || !promo || !promo.is_active) {
        return jsonResponse(404, {
          code: "PROMO_NOT_FOUND",
          message: "Промокод не существует или не активен.",
        });
      }

      const usedBy = Array.isArray(promo.used_by) ? promo.used_by : [];
      if (usedBy.includes(session.profile_id)) {
        return jsonResponse(400, {
          code: "PROMO_ALREADY_USED",
          message: "Этот промокод уже был активирован на вашем аккаунте.",
        });
      }

      if (promo.max_uses > 0 && (promo.used_count || 0) >= promo.max_uses) {
        return jsonResponse(400, {
          code: "PROMO_DEPLETED",
          message: "Лимит активаций этого промокода исчерпан.",
        });
      }

      const durationDays = Number(promo.duration_days) || 30;
      const targetRole = String(promo.role || "subscriber").toLowerCase();
      const isLifetime = durationDays >= 99999 || targetRole === "lifetime";

      // 3. Calculate new subscription expiry
      const now = Date.now();
      const currentUntilTime = currentProfile.subscription_until ? new Date(currentProfile.subscription_until).getTime() : 0;
      let newUntilIso = "2999-12-31T22:01:00.000Z";
      let newUntilTime = new Date(newUntilIso).getTime();

      if (!isLifetime) {
        const baseTime = currentUntilTime > now ? currentUntilTime : now;
        newUntilTime = baseTime + durationDays * 86400000;
        newUntilIso = new Date(newUntilTime).toISOString();
      }

      // 4. Update roles and profile in Supabase
      const currentRoles = Array.isArray(currentProfile.roles) ? [...currentProfile.roles] : [];
      if (!currentRoles.map((r: string) => r.toLowerCase().trim()).includes(targetRole)) {
        currentRoles.push(targetRole);
      }
      if (!isLifetime && !currentRoles.map((r: string) => r.toLowerCase().trim()).includes("subscriber")) {
        currentRoles.push("subscriber");
      }

      const historyItem = {
        id: "act_" + Date.now(),
        type: "promo",
        code: inputCode,
        durationDays,
        isLifetime,
        activatedAt: new Date().toISOString(),
        subscriptionUntil: newUntilIso,
        note: promo.note || "",
      };

      const existingHistory = Array.isArray(currentProfile.activation_history) ? currentProfile.activation_history : [];

      await supabase
        .from("profiles")
        .update({
          roles: currentRoles,
          subscription_until: newUntilIso,
          is_frozen: false,
          frozen_at: null,
          frozen_remaining_ms: 0,
          activation_history: [historyItem, ...existingHistory].slice(0, 50),
        })
        .eq("profile_id", session.profile_id);

      await supabase
        .from("promo_codes")
        .update({
          used_count: (promo.used_count || 0) + 1,
          used_by: [...usedBy, session.profile_id],
        })
        .eq("code", promo.code);

      return jsonResponse(200, {
        ok: true,
        durationDays,
        newUntil: newUntilIso,
        newUntilSec: Math.floor(newUntilTime / 1000),
        plan: isLifetime ? "lifetime" : "prem",
        message: `Промокод успешно активирован! Добавлено +${durationDays} дн. подписки.`,
      });
    }

    // 12. CLIENT DOWNLOAD ROUTE (/download, /v1/download)
    if (path.endsWith("/download") || path.endsWith("/v1/download")) {
      const authHeader = req.headers.get("authorization") || "";
      const urlObj = new URL(req.url);
      const token = authHeader.replace(/^Bearer\s+/i, "").trim() || urlObj.searchParams.get("token") || "";

      if (!token) {
        return jsonResponse(401, { code: "UNAUTHORIZED", message: "Token required" });
      }

      const session = await verifyToken(token);
      if (!session) {
        return jsonResponse(401, { code: "SESSION_EXPIRED" });
      }

      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("roles, is_banned, firebase_uid")
        .eq("profile_id", session.profile_id)
        .maybeSingle();

      if (!currentProfile || currentProfile.is_banned) {
        return jsonResponse(403, { code: "FORBIDDEN" });
      }

      const live = await getLiveProfileInfo(currentProfile.firebase_uid);
      const combinedRoles = Array.from(new Set([...(currentProfile.roles || []), ...live.roles]))
        .map((r: string) => r.toLowerCase().trim());

      const isAllowed = combinedRoles.some((r: string) => r === "co-owner" || r === "coowner" || r === "root");
      if (!isAllowed) {
        return jsonResponse(403, {
          code: "FORBIDDEN",
          message: "Скачивание временно доступно только для пользователей с ролью co-owner.",
        });
      }

      return jsonResponse(200, {
        status: "ok",
        filename: "Sakura.zip",
        totalSize: 261136292,
        baseUrl: `${supabaseUrl}/storage/v1/object/public/downloads`,
        parts: [
          "Sakura.zip.part0",
          "Sakura.zip.part1",
          "Sakura.zip.part2",
          "Sakura.zip.part3",
          "Sakura.zip.part4",
          "Sakura.zip.part5",
          "Sakura.zip.part6",
        ],
      });
    }

    return jsonResponse(404, { code: "NOT_FOUND", path });
  } catch (error) {
    console.error("Auth Edge Function error:", error);
    return jsonResponse(500, {
      code: "SERVER_ERROR",
      message: error instanceof Error ? error.message : "Internal error",
    });
  }
});
