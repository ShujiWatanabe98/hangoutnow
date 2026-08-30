import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function equalSecret(actual: string, expected: string) {
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.endsWith("/api/healthz")) return NextResponse.next();
  const expected = process.env.ROBOREHA_PROXY_SECRET?.trim() ?? "";
  if (!expected) return new NextResponse("Service unavailable", { status: 503 });
  const actual = request.headers.get("x-roboreha-proxy-secret") ?? "";
  if (!equalSecret(actual, expected)) return new NextResponse("Not found", { status: 404 });
  const response = NextResponse.next();
  response.headers.set("x-robots-tag", "noindex, nofollow, noarchive");
  return response;
}
