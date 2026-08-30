import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { PRIVATE_AUTH_COOKIE, verifyPrivateSession } from "@/lib/private-auth";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname.endsWith("/api/healthz") || pathname.includes("/_next/") || pathname.endsWith("/manifest.webmanifest") || pathname.endsWith("/icon.svg") || pathname.endsWith("/login") || pathname.endsWith("/api/private-auth")) return NextResponse.next();

  const proxySecret = process.env.ROBOREHA_PROXY_SECRET?.trim() ?? "";
  if (proxySecret && request.headers.get("x-roboreha-proxy-secret") !== proxySecret) return new NextResponse("Not found", { status: 404, headers: { "x-robots-tag": "noindex, nofollow, noarchive" } });

  if (!(await verifyPrivateSession(request.cookies.get(PRIVATE_AUTH_COOKIE)?.value))) {
    if (pathname.includes("/api/")) return NextResponse.json({ error: "ログインが必要です。" }, { status: 401, headers: { "x-robots-tag": "noindex, nofollow, noarchive" } });
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    return NextResponse.redirect(login);
  }

  const response = NextResponse.next();
  response.headers.set("x-robots-tag", "noindex, nofollow, noarchive");
  return response;
}
