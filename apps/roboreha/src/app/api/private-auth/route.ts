import { NextResponse } from "next/server";
import { ROBOREHA_BASE_PATH } from "@/lib/base-path";
import { createPrivateSession, PRIVATE_AUTH_COOKIE, PRIVATE_AUTH_MAX_AGE, verifyPrivateCredentials } from "@/lib/private-auth";
import { sameOriginRedirect } from "@/lib/same-origin-redirect";

const attempts = new Map<string, { failures: number; lockedUntil: number }>();

export async function POST(request: Request) {
  const key = (request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown").split(",", 1)[0].trim();
  const now = Date.now();
  const previous = attempts.get(key);
  if (previous?.lockedUntil && previous.lockedUntil > now) {
    return new NextResponse(null, sameOriginRedirect(`${ROBOREHA_BASE_PATH}/login?locked=1`));
  }

  const form = await request.formData();
  const valid = verifyPrivateCredentials(String(form.get("username") ?? ""), String(form.get("password") ?? ""));
  if (!valid) {
    const failures = (previous?.failures ?? 0) + 1;
    attempts.set(key, { failures, lockedUntil: failures >= 5 ? now + 15 * 60_000 : 0 });
    return new NextResponse(null, sameOriginRedirect(`${ROBOREHA_BASE_PATH}/login?error=1`));
  }

  attempts.delete(key);
  // The combined Render router forwards the request to an internal Next.js
  // port, so request.url has an internal origin such as localhost:3101.
  // A relative Location keeps the browser on method-more.com.
  const response = new NextResponse(null, sameOriginRedirect(`${ROBOREHA_BASE_PATH}/`));
  response.cookies.set(PRIVATE_AUTH_COOKIE, await createPrivateSession(), { httpOnly: true, secure: true, sameSite: "strict", path: ROBOREHA_BASE_PATH || "/", maxAge: PRIVATE_AUTH_MAX_AGE });
  return response;
}
