import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { query } from "@/lib/db";

export const PRIVATE_AUTH_COOKIE = "__Secure-roboreha_app";
export const PRIVATE_AUTH_MAX_AGE = 8 * 60 * 60;

const fallbackUsername = "inteprobo";
const fallbackPasswordVerifier = "aXk8_y1pe3kSlU6iY0Dwh_WI6NS5joQl.fxKu5dq8M0Tl82xqaFJjHCfrihTBUmf2PDOyEGXJvhY";

function equal(left: Buffer, right: Buffer) {
  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifyPrivateCredentials(username: string, password: string) {
  const expectedUsername = process.env.ROBOREHA_USERNAME || fallbackUsername;
  const usernameMatches = equal(Buffer.from(username), Buffer.from(expectedUsername));
  const configuredPassword = process.env.ROBOREHA_PASSWORD;
  if (configuredPassword) return usernameMatches && equal(Buffer.from(password), Buffer.from(configuredPassword));

  const [saltValue, hashValue] = fallbackPasswordVerifier.split(".");
  const salt = Buffer.from(saltValue, "base64url");
  const expectedHash = Buffer.from(hashValue, "base64url");
  const actualHash = scryptSync(password, salt, expectedHash.length, { N: 65_536, r: 8, p: 1, maxmem: 96 * 1024 * 1024 });
  return usernameMatches && equal(actualHash, expectedHash);
}

function sessionHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createPrivateSession() {
  const token = randomBytes(32).toString("base64url");
  await query("DELETE FROM private_preview_sessions WHERE expires_at <= now()");
  await query("INSERT INTO private_preview_sessions (token_hash, expires_at) VALUES ($1, now() + ($2 * interval '1 second'))", [sessionHash(token), PRIVATE_AUTH_MAX_AGE]);
  return token;
}

export async function verifyPrivateSession(token: string | undefined) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token ?? "")) return false;
  const result = await query("SELECT 1 FROM private_preview_sessions WHERE token_hash=$1 AND expires_at>now() LIMIT 1", [sessionHash(token ?? "")]);
  return Boolean(result.rowCount);
}
