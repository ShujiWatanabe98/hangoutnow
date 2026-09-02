import { describe, expect, it } from "vitest";
import { isRoboCareRequest, targetForRequest } from "../scripts/render-router.mjs";

describe("combined Render router", () => {
  const targets = { api: "http://api", robocare: "http://robocare" };

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

  it.each(["/", "/health", "/auth/google/start", "/socket.io/?EIO=4", "/roboreha-application"])(
    "keeps %s on the HangoutNow API",
    (url) => {
      expect(isRoboCareRequest(url)).toBe(false);
      expect(targetForRequest(url, targets)).toBe(targets.api);
    },
  );
});
