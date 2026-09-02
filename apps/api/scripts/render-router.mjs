export const ROBOCARE_BASE_PATH = "/roboreha-app";

export function isRoboCareRequest(requestUrl, basePath = ROBOCARE_BASE_PATH) {
  const pathname = new URL(requestUrl ?? "/", "http://render.internal").pathname;
  return pathname === basePath || pathname.startsWith(`${basePath}/`);
}

export function targetForRequest(requestUrl, targets, basePath = ROBOCARE_BASE_PATH) {
  return isRoboCareRequest(requestUrl, basePath) ? targets.robocare : targets.api;
}
