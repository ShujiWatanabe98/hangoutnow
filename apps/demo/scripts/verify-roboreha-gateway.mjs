import assert from "node:assert/strict";

const origin = process.env.ROBOREHA_VERIFY_ORIGIN?.replace(/\/$/, "");
const route = process.env.ROBOREHA_ROUTE_PATH;
const username = process.env.ROBOREHA_USERNAME;
const password = process.env.ROBOREHA_PASSWORD;
const upstream = process.env.ROBOREHA_VERIFY_UPSTREAM?.replace(/\/$/, "");

assert(origin, "ROBOREHA_VERIFY_ORIGIN is required");
assert(/^\/roboreha-preview-[a-z0-9]{16,64}$/.test(route ?? ""), "ROBOREHA_ROUTE_PATH is invalid");
assert(username && password, "ROBOREHA_USERNAME and ROBOREHA_PASSWORD are required");

const homepage = await fetch(`${origin}/`, { redirect: "follow" });
assert.equal(homepage.status, 200);
const homepageHtml = await homepage.text();
assert.equal(homepageHtml.includes(`${route}/login`), true, "The private login is not linked from the homepage");
assert.equal(homepageHtml.includes(`href="${route}"`), false, "The retired private entry is still linked from the homepage");

const retiredEntry = await fetch(`${origin}${route}/`, { redirect: "manual" });
assert.equal(retiredEntry.status, 302);
assert.equal(retiredEntry.headers.get("location"), "/#robocare-one");

const unauthenticated = await fetch(`${origin}${route}/login`, { redirect: "follow" });
const loginHtml = await unauthenticated.text();
assert.equal(unauthenticated.status, 200);
assert.match(loginHtml, /ユーザー名とパスワード/);
assert.doesNotMatch(loginHtml, /施設iPad|顧客スマホ登録/);
assert.equal(unauthenticated.headers.get("x-robots-tag"), "noindex, nofollow, noarchive");
const loginEndpoint = loginHtml.includes("/api/private-auth") ? "/api/private-auth" : "/_auth/login";

const rejected = await fetch(`${origin}${route}${loginEndpoint}`, {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ username, password: `${password}-invalid` }),
  redirect: "manual",
});
assert([303, 401].includes(rejected.status));
assert.equal(rejected.headers.has("set-cookie"), false);

const login = await fetch(`${origin}${route}${loginEndpoint}`, {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ username, password }),
  redirect: "manual",
});
assert.equal(login.status, 303);
const setCookie = login.headers.get("set-cookie") ?? "";
assert.match(setCookie, /HttpOnly/);
assert.match(setCookie, /Secure/);
assert.match(setCookie, /SameSite=Strict/i);
const cookie = setCookie.split(";", 1)[0];

const authenticatedFetch = (path) => fetch(`${origin}${route}${path}`, { headers: { cookie }, redirect: "follow" });
const [entry, facility, customer, admin, dashboard, schedule] = await Promise.all([
  authenticatedFetch("/"),
  authenticatedFetch("/facility"),
  authenticatedFetch("/customer"),
  authenticatedFetch("/admin"),
  authenticatedFetch("/api/dashboard"),
  authenticatedFetch("/api/schedule?date=2026-09-01"),
]);

for (const response of [entry, facility, customer, admin, dashboard, schedule]) assert.equal(response.status, 200);
assert.match(
  facility.headers.get("content-security-policy") ?? "",
  /media-src 'self' blob:/,
  "The public gateway must allow locally selected blob videos to play and be analyzed",
);
const entryHtml = await entry.text();
assert.match(entryHtml, /施設iPad/);
assert.match(entryHtml, /顧客スマホ登録/);
const assetPath = entryHtml.match(/(?:src|href)="([^"]*\/_next\/[^"]+)"/)?.[1];
assert(assetPath, "No Next.js asset was found below the private route");
assert(assetPath.startsWith(`${route}/_next/`), "Next.js asset escaped the private route");
const asset = await fetch(`${origin}${assetPath}`, { headers: { cookie }, redirect: "follow" });
assert.equal(asset.status, 200);

const dashboardBody = await dashboard.json();
const scheduleBody = await schedule.json();
assert(dashboardBody && typeof dashboardBody === "object");
assert(scheduleBody && typeof scheduleBody === "object");

let directStatus = null;
if (upstream) {
  const direct = await fetch(`${upstream}${route}/`, { redirect: "follow" });
  directStatus = direct.status;
  const directBody = await direct.text();
  assert(direct.status === 404 || (direct.status === 200 && /ユーザー名とパスワード/.test(directBody) && !/施設iPad/.test(directBody)), "The private upstream exposes RoboReha without authentication");
}

console.log(JSON.stringify({
  homepage: homepage.status,
  retiredEntry: retiredEntry.status,
  unauthenticated: unauthenticated.status,
  rejectedLogin: rejected.status,
  authenticatedEntry: entry.status,
  facility: facility.status,
  customer: customer.status,
  admin: admin.status,
  dashboard: dashboard.status,
  schedule: schedule.status,
  asset: asset.status,
  directUpstream: directStatus,
}));
