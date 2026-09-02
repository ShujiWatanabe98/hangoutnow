export const ROBOCARE_BASE_PATH = "/roboreha-app";
export const SALONRECORD_BASE_PATH = "/salonrecord";
export const AIOCR_BASE_PATH = "/ai-ocr";
export const WEBSITE_BASE_PATH = "/site";

const websiteHosts = new Set(["method-more.com", "www.method-more.com"]);

function pathnameOf(requestUrl) {
  return new URL(requestUrl ?? "/", "http://render.internal").pathname;
}

function isPathWithin(requestUrl, basePath) {
  const pathname = pathnameOf(requestUrl);
  return pathname === basePath || pathname.startsWith(`${basePath}/`);
}

function requestParts(request) {
  if (typeof request === "string") return { url: request, headers: {} };
  return { url: request?.url ?? "/", headers: request?.headers ?? {} };
}

function refererPath(headers) {
  try {
    return new URL(String(headers.referer ?? headers.referrer ?? "")).pathname;
  } catch {
    return "";
  }
}

export function isRoboCareRequest(requestUrl, basePath = ROBOCARE_BASE_PATH) {
  return isPathWithin(requestUrl, basePath);
}

export function routeForRequest(request) {
  const { url, headers } = requestParts(request);
  if (isPathWithin(url, ROBOCARE_BASE_PATH)) return "robocare";
  if (isPathWithin(url, SALONRECORD_BASE_PATH)) return "salonrecord";
  if (isPathWithin(url, AIOCR_BASE_PATH)) return "aiocr";
  if (isPathWithin(url, WEBSITE_BASE_PATH)) return "demo";

  const referringPath = refererPath(headers);
  if (isPathWithin(referringPath, SALONRECORD_BASE_PATH)) return "salonrecord";
  if (isPathWithin(referringPath, AIOCR_BASE_PATH)) return "aiocr";
  if (isPathWithin(referringPath, WEBSITE_BASE_PATH)) return "demo";

  const host = String(headers.host ?? "").split(":", 1)[0].toLowerCase();
  return websiteHosts.has(host) ? "demo" : "api";
}

export function rewriteUrlForRoute(requestUrl, route) {
  const basePath = route === "salonrecord"
    ? SALONRECORD_BASE_PATH
    : route === "aiocr"
      ? AIOCR_BASE_PATH
      : route === "demo"
        ? WEBSITE_BASE_PATH
        : "";
  if (!basePath || !isPathWithin(requestUrl, basePath)) return requestUrl ?? "/";
  const parsed = new URL(requestUrl ?? "/", "http://render.internal");
  const stripped = parsed.pathname.slice(basePath.length) || "/";
  return `${stripped}${parsed.search}`;
}

export function targetForRequest(request, targets) {
  return targets[routeForRequest(request)];
}
