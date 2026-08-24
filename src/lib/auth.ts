import bcrypt from "bcryptjs";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET env var is not set");
  return secret;
}

function base64url(bytes: ArrayBuffer | Uint8Array): string {
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let str = "";
  for (const b of buf) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(
    value.length + ((4 - (value.length % 4)) % 4),
    "="
  );
  const str = atob(padded);
  const buffer = new ArrayBuffer(str.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes;
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

const USER_SESSION_COOKIE = "customer_session";
const USER_SESSION_TTL_MS = SESSION_TTL_MS;

/** Signed "logged in as this user" token, shared by customers and admins —
 *  admin access is just the isAdmin flag on that user's row (see
 *  db/queries.ts getCurrentUser and proxy.ts), not a separate session type. */
export async function createUserSessionToken(userId: number): Promise<string> {
  const payload = JSON.stringify({ userId, exp: Date.now() + USER_SESSION_TTL_MS });
  const payloadB64 = base64url(new TextEncoder().encode(payload));
  const key = await hmacKey();
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
  return `${payloadB64}.${base64url(sig)}`;
}

export async function verifyUserSessionToken(token: string | undefined | null): Promise<number | null> {
  if (!token) return null;
  const [payloadB64, sigB64] = token.split(".");
  if (!payloadB64 || !sigB64) return null;

  try {
    const key = await hmacKey();
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64urlToBytes(sigB64),
      new TextEncoder().encode(payloadB64)
    );
    if (!valid) return null;

    const payload = JSON.parse(new TextDecoder().decode(base64urlToBytes(payloadB64))) as {
      userId: number;
      exp: number;
    };
    if (payload.exp <= Date.now()) return null;
    return payload.userId;
  } catch {
    return null;
  }
}

export { USER_SESSION_COOKIE, USER_SESSION_TTL_MS };
