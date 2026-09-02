import { describe, expect, it } from "vitest";
import {
  isRoboCareRequest,
  rewriteUrlForRoute,
  routeForRequest,
  targetForRequest,
} from "../scripts/render-router.mjs";

describe("MethodMore combined Render router", () => {
  const targets = {
    api: "http://api",
    robocare: "http://robocare",
    demo: "http://demo",
    salonrecord: "http://salonrecord",
    aiocr: "http://aiocr",
  };

  it.each([
    "/roboreha-app",
    "/roboreha-app/",
    "/roboreha-app/login?next=%2Ffacility",
    "/roboreha-app/_next/static/app.js",
    "/roboreha-app/api/healthz",
  ])("routes %s to RoboCareOne", (url) => {
    expect(isRoboCareRequest(url)).toBe(true);
    expect(targetForRequest(url, targets)).toBe(targets.robocare);
  });

  it.each([
    ["/salonrecord", "salonrecord", "/"],
    ["/salonrecord/healthz?full=1", "salonrecord", "/healthz?full=1"],
    ["/ai-ocr", "aiocr", "/"],
    ["/ai-ocr/api/health", "aiocr", "/api/health"],
    ["/site", "demo", "/"],
    ["/site/coachgo-demo/", "demo", "/coachgo-demo/"],
  ])("routes and rewrites %s", (url, expectedRoute, expectedUrl) => {
    expect(routeForRequest({ url, headers: { host: "hangoutnow-api.onrender.com" } })).toBe(expectedRoute);
    expect(rewriteUrlForRoute(url, expectedRoute)).toBe(expectedUrl);
  });

  it.each([
    ["/api/login", "https://hangoutnow-api.onrender.com/salonrecord", "salonrecord"],
    ["/styles.css", "https://hangoutnow-api.onrender.com/ai-ocr", "aiocr"],
    ["/corporate.css", "https://hangoutnow-api.onrender.com/site", "demo"],
  ])("uses the referring product for root-relative request %s", (url, referer, expected) => {
    expect(routeForRequest({ url, headers: { host: "hangoutnow-api.onrender.com", referer } })).toBe(expected);
  });

  it("serves the corporate website on its custom domain", () => {
    expect(routeForRequest({ url: "/", headers: { host: "method-more.com" } })).toBe("demo");
    expect(routeForRequest({ url: "/api/coachgo/reports", headers: { host: "method-more.com" } })).toBe("demo");
  });

  it("always routes the Render health check to the platform API", () => {
    expect(routeForRequest({ url: "/health", headers: { host: "method-more.com" } })).toBe("api");
    expect(routeForRequest({ url: "/health?source=render", headers: { host: "www.method-more.com" } })).toBe("api");
  });

  it.each(["/", "/health", "/auth/google/start", "/socket.io/?EIO=4"])(
    "keeps %s on the platform API hostname",
    (url) => {
      expect(routeForRequest({ url, headers: { host: "hangoutnow-api.onrender.com" } })).toBe("api");
    },
  );
});
