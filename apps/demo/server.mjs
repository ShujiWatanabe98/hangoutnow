import { createServer } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const port = Number(process.env.DEMO_PORT ?? 4173);
const root = join(import.meta.dirname, 'public');
const hangoutNowAdminRoot = join(import.meta.dirname, '../admin/out');
const hangoutNowAdminPath = '/hangoutnow-admin';
const hangoutNowApiPath = '/hangoutnow-api';
const proxyApiUrl = (process.env.DEMO_PROXY_API_URL || process.env.API_URL)?.replace(/\/$/, '');
const dashboardPathCandidate = process.env.DIVERTNAVI_DASHBOARD_PATH?.trim().replace(/\/+$/, '') ?? '';
const divertNaviDashboardPath = /^\/divertnavi-app\/[a-z0-9](?:[a-z0-9-]{22,}[a-z0-9])$/.test(dashboardPathCandidate) ? dashboardPathCandidate : '';
const divertNaviCollector = divertNaviDashboardPath ? import('./divertnavi-collector/service.mjs') : null;
const weathernewsRadarUrl = 'https://wxtech.weathernews.com/api/v1/tile/prec';
const roborehaPathCandidate = process.env.ROBOREHA_ROUTE_PATH?.trim().replace(/\/+$/, '') || '/roboreha-preview-320b600f541ac09e';
const roborehaRoutePath = /^\/roboreha-preview-[a-z0-9]{16,64}$/.test(roborehaPathCandidate) ? roborehaPathCandidate : '';
const roborehaUpstreamOrigin = process.env.ROBOREHA_UPSTREAM_ORIGIN?.trim().replace(/\/+$/, '') || 'https://methodmore-roboreha-private.onrender.com';
const roborehaUsername = process.env.ROBOREHA_USERNAME ?? '';
const roborehaPassword = process.env.ROBOREHA_PASSWORD ?? '';
const roborehaSessionSecret = process.env.ROBOREHA_SESSION_SECRET ?? '';
const roborehaProxySecret = process.env.ROBOREHA_PROXY_SECRET ?? '';
const roborehaCookieName = '__Secure-roboreha_preview';
const roborehaSessionSeconds = 8 * 60 * 60;
const roborehaLoginAttempts = new Map();
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.map': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
const securityHeaders = {
  'content-security-policy': "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://www.googletagmanager.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://api.mapbox.com https://*.tiles.mapbox.com https://tilecache.rainviewer.com https://hangoutnow-demo.onrender.com https://play.google.com https://tools.applemediaservices.com; media-src 'self' blob:; frame-src https://maps.google.com; connect-src 'self' https://api.mapbox.com https://events.mapbox.com https://*.tiles.mapbox.com https://api.rainviewer.com https://tilecache.rainviewer.com https://api.open-meteo.com https://www.google-analytics.com https://region1.google-analytics.com; font-src 'self'; worker-src blob:; upgrade-insecure-requests",
  'cross-origin-opener-policy': 'same-origin-allow-popups',
  'permissions-policy': 'camera=(self), geolocation=(self), microphone=(self)',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
};

function secureDigest(value, secret) {
  return createHmac('sha256', secret).update(String(value)).digest();
}

function secureEqual(actual, expected, secret) {
  return timingSafeEqual(secureDigest(actual, secret), secureDigest(expected, secret));
}

function sessionToken() {
  const expiresAt = Math.floor(Date.now() / 1000) + roborehaSessionSeconds;
  const payload = `v1.${expiresAt}`;
  const signature = createHmac('sha256', roborehaSessionSecret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function hasValidRoborehaSession(request) {
  if (!roborehaSessionSecret) return false;
  const cookies = Object.fromEntries((request.headers.cookie ?? '').split(';').map((part) => part.trim().split(/=(.*)/s).slice(0, 2)).filter(([key]) => key));
  const token = cookies[roborehaCookieName] ?? '';
  const match = /^v1\.(\d{10})\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!match || Number(match[1]) <= Math.floor(Date.now() / 1000)) return false;
  const payload = `v1.${match[1]}`;
  const expected = createHmac('sha256', roborehaSessionSecret).update(payload).digest('base64url');
  return secureEqual(match[2], expected, roborehaSessionSecret);
}

function roborehaConfigured() {
  let validUpstream = false;
  try {
    const upstream = new URL(roborehaUpstreamOrigin);
    const localHttp = upstream.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(upstream.hostname);
    validUpstream = upstream.protocol === 'https:' || localHttp;
  } catch {
    validUpstream = false;
  }
  return Boolean(roborehaRoutePath && validUpstream);
}

function roborehaGatewayAuthConfigured() {
  return Boolean(roborehaUsername && roborehaPassword && roborehaSessionSecret.length >= 32 && roborehaProxySecret.length >= 32);
}

function loginClientKey(request) {
  return String(request.headers['cf-connecting-ip'] || request.headers['x-forwarded-for'] || request.socket.remoteAddress || 'unknown').split(',')[0].trim();
}

function loginPage(errorMessage = '', status = 200) {
  const escapedError = errorMessage.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const body = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>RoboReha Preview</title><style>:root{color-scheme:light}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:linear-gradient(145deg,#e8f5f2,#f7faf9 48%,#edf0fb);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",sans-serif;color:#17353d;padding:20px}.card{width:min(440px,100%);background:#fff;border:1px solid #d7e6e2;border-radius:28px;padding:30px;box-shadow:0 24px 70px rgba(23,53,61,.14)}.brand{display:flex;align-items:center;gap:12px}.mark{display:grid;place-items:center;width:48px;height:48px;border-radius:15px;background:#087f71;color:#fff;font-size:25px;font-weight:900}.eyebrow{margin:0;color:#087f71;font-size:12px;font-weight:900;letter-spacing:.12em}.title{margin:8px 0 6px;font-size:30px;line-height:1.25}.lead{margin:0 0 22px;color:#687d84;line-height:1.7}.field{display:block;margin-top:14px;font-size:13px;font-weight:800}.field input{display:block;width:100%;min-height:54px;margin-top:7px;border:2px solid #d7e4e1;border-radius:14px;padding:0 15px;font-size:18px;outline:none}.field input:focus{border-color:#087f71;box-shadow:0 0 0 4px #dff4ed}.error{margin:0 0 12px;padding:12px;border-radius:12px;background:#fff0ed;color:#a94334;font-weight:800}.submit{width:100%;min-height:56px;margin-top:20px;border:0;border-radius:15px;background:#087f71;color:#fff;font-size:18px;font-weight:900;cursor:pointer}.note{margin:18px 0 0;text-align:center;color:#839397;font-size:12px;line-height:1.6}</style></head><body><main class="card"><div class="brand"><div class="mark">R</div><div><p class="eyebrow">PRIVATE PREVIEW</p><strong>RoboCare One</strong></div></div><h1 class="title">RoboReha</h1><p class="lead">閲覧にはユーザー名とパスワードが必要です。</p>${escapedError ? `<p class="error" role="alert">${escapedError}</p>` : ''}<form method="post" action="${roborehaRoutePath}/_auth/login"><label class="field">ユーザー名<input name="username" type="text" autocomplete="username" required autofocus></label><label class="field">パスワード<input name="password" type="password" autocomplete="current-password" required></label><button class="submit" type="submit">ログイン</button></form><p class="note">このページは限定共有の検証環境です。<br>データは架空のデモ情報です。</p></main></body></html>`;
  return { status, body };
}

async function readSmallForm(request) {
  return new Promise((resolve, reject) => {
    let text = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      text += chunk;
      if (text.length > 16_384) reject(new Error('Request too large'));
    });
    request.on('end', () => resolve(new URLSearchParams(text)));
    request.on('error', reject);
  });
}

async function proxyRoboreha(request, response) {
  const headers = new Headers();
  for (const name of ['accept', 'accept-language', 'content-type', 'cookie', 'range', 'user-agent']) {
    const value = request.headers[name];
    if (value) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
  }
  if (roborehaProxySecret) headers.set('x-roboreha-proxy-secret', roborehaProxySecret);
  headers.set('x-forwarded-host', request.headers.host ?? 'method-more.com');
  headers.set('x-forwarded-proto', 'https');
  try {
    const hasBody = !['GET', 'HEAD'].includes(request.method ?? 'GET');
    const upstream = await fetch(`${roborehaUpstreamOrigin}${request.url}`, {
      method: request.method,
      headers,
      body: hasBody ? request : undefined,
      redirect: 'manual',
      ...(hasBody ? { duplex: 'half' } : {}),
    });
    const responseHeaders = {
      ...securityHeaders,
      'content-type': upstream.headers.get('content-type') || 'application/octet-stream',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex, nofollow, noarchive',
    };
    for (const name of ['etag', 'last-modified', 'accept-ranges', 'content-range']) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders[name] = value;
    }
    const location = upstream.headers.get('location');
    if (location) {
      try {
        const redirect = new URL(location, roborehaUpstreamOrigin);
        responseHeaders.location = `${redirect.pathname}${redirect.search}${redirect.hash}`;
      } catch { responseHeaders.location = roborehaRoutePath; }
    }
    const setCookie = upstream.headers.get('set-cookie');
    if (setCookie) responseHeaders['set-cookie'] = setCookie;
    response.writeHead(upstream.status, responseHeaders);
    if (request.method === 'HEAD' || !upstream.body) response.end();
    else {
      const reader = upstream.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!response.write(Buffer.from(value))) await new Promise((resolve) => response.once('drain', resolve));
      }
      response.end();
    }
  } catch {
    response.writeHead(502, { ...securityHeaders, 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow, noarchive' });
    response.end('RoboReha preview is temporarily unavailable.');
  }
}

createServer(async (request, response) => {
  const requestedPath = request.url?.split('?')[0] ?? '/';
  const normalizedRequestedPath = requestedPath.replace(/\/+$/, '') || '/';
  if (roborehaRoutePath && (normalizedRequestedPath === roborehaRoutePath || requestedPath.startsWith(`${roborehaRoutePath}/`))) {
    if (!roborehaConfigured()) {
      response.writeHead(503, { ...securityHeaders, 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow, noarchive' });
      response.end('RoboReha preview is not configured.');
      return;
    }
    const gatewayAuth = roborehaGatewayAuthConfigured();
    if (gatewayAuth && requestedPath === `${roborehaRoutePath}/_auth/login` && request.method === 'POST') {
      const key = loginClientKey(request);
      const now = Date.now();
      const previous = roborehaLoginAttempts.get(key);
      if (previous?.lockedUntil > now) {
        const page = loginPage('試行回数が多すぎます。しばらく待ってからお試しください。', 429);
        response.writeHead(page.status, { ...securityHeaders, 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow, noarchive' });
        response.end(page.body);
        return;
      }
      try {
        const form = await readSmallForm(request);
        const valid = secureEqual(form.get('username') ?? '', roborehaUsername, roborehaSessionSecret) && secureEqual(form.get('password') ?? '', roborehaPassword, roborehaSessionSecret);
        if (valid) {
          roborehaLoginAttempts.delete(key);
          response.writeHead(303, {
            ...securityHeaders,
            location: `${roborehaRoutePath}/`,
            'set-cookie': `${roborehaCookieName}=${sessionToken()}; Path=${roborehaRoutePath}; Max-Age=${roborehaSessionSeconds}; HttpOnly; Secure; SameSite=Strict`,
            'cache-control': 'no-store',
            'x-robots-tag': 'noindex, nofollow, noarchive',
          });
          response.end();
          return;
        }
        const failures = (previous?.failures ?? 0) + 1;
        roborehaLoginAttempts.set(key, { failures, lockedUntil: failures >= 5 ? now + 15 * 60_000 : 0 });
        const page = loginPage('ユーザー名またはパスワードが違います。', 401);
        response.writeHead(page.status, { ...securityHeaders, 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow, noarchive' });
        response.end(page.body);
        return;
      } catch {
        response.writeHead(400, { ...securityHeaders, 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
        response.end('Invalid login request.');
        return;
      }
    }
    if (gatewayAuth && !hasValidRoborehaSession(request)) {
      const page = loginPage();
      response.writeHead(page.status, { ...securityHeaders, 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow, noarchive' });
      response.end(page.body);
      return;
    }
    if (gatewayAuth && requestedPath.startsWith(`${roborehaRoutePath}/_auth/`)) {
      response.writeHead(404, { ...securityHeaders, 'cache-control': 'no-store' });
      response.end('Not found');
      return;
    }
    await proxyRoboreha(request, response);
    return;
  }
  if (requestedPath === '/demo.html' && request.url === '/demo.html') {
    response.writeHead(302, {
      ...securityHeaders,
      location: '/demo.html?resetAuth=1',
      'cache-control': 'no-store',
    });
    response.end();
    return;
  }
  if (requestedPath === '/tokyo-working-adult-friends.html') {
    response.writeHead(301, {
      ...securityHeaders,
      location: '/shinjuku-working-adult-friends.html',
      'cache-control': 'no-store',
    });
    response.end();
    return;
  }
  if (divertNaviCollector && requestedPath.startsWith(`${divertNaviDashboardPath}/api/collector/`)) {
    try {
      const collector = await divertNaviCollector;
      await collector.ready;
      const action = requestedPath.slice(`${divertNaviDashboardPath}/api/collector/`.length);
      let result;
      if (request.method === 'GET' && action === 'status') result = collector.getCollectorStatus();
      else if (request.method === 'POST' && action === 'start') {
        const body = await new Promise((resolve, reject) => {
          let text = '';
          request.on('data', (chunk) => { text += chunk; if (text.length > 16384) reject(new Error('リクエストが大きすぎます')); });
          request.on('end', () => { try { resolve(text ? JSON.parse(text) : {}); } catch (error) { reject(error); } });
          request.on('error', reject);
        });
        const prefectureCodes = Array.isArray(body.prefectureCodes) ? body.prefectureCodes : [];
        if (!prefectureCodes.length || prefectureCodes.some((code) => !/^\d{2}$/.test(code))) {
          response.writeHead(400, { ...securityHeaders, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
          response.end(JSON.stringify({ error: '対象都道府県が不正です' }));
          return;
        }
        result = await collector.startCollector(prefectureCodes);
      } else if (request.method === 'POST' && action === 'stop') result = collector.stopCollector();
      else {
        response.writeHead(404, { ...securityHeaders, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
        response.end(JSON.stringify({ error: 'Not found' }));
        return;
      }
      response.writeHead(200, { ...securityHeaders, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      response.end(JSON.stringify(result));
    } catch (error) {
      response.writeHead(500, { ...securityHeaders, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    }
    return;
  }
  if (request.method === 'GET' && requestedPath === '/api/weather/radar') {
    const apiKey = process.env.WXTECH_API_KEY?.trim() ?? '';
    if (!apiKey) {
      response.writeHead(503, { ...securityHeaders, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      response.end(JSON.stringify({ code: 'WXTECH_NOT_CONFIGURED', message: 'Weathernews API is not configured; use RainViewer.' }));
      return;
    }
    try {
      const upstream = await fetch(weathernewsRadarUrl, { headers: { 'X-Api-Key': apiKey }, signal: AbortSignal.timeout(15_000) });
      const body = Buffer.from(await upstream.arrayBuffer());
      response.writeHead(upstream.status, {
        ...securityHeaders,
        'content-type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
        'cache-control': upstream.ok ? 'public, max-age=240' : 'no-store',
      });
      response.end(body);
    } catch {
      response.writeHead(502, { ...securityHeaders, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      response.end(JSON.stringify({ code: 'WXTECH_UPSTREAM_ERROR', message: 'Weathernews API is temporarily unavailable; use RainViewer.' }));
    }
    return;
  }
  const isPublicApiRequest = requestedPath.startsWith('/api/');
  const isAdminApiRequest = requestedPath.startsWith(`${hangoutNowApiPath}/`);
  if(proxyApiUrl&&(isPublicApiRequest||isAdminApiRequest)){
    try{
      const body=request.method==='GET'||request.method==='HEAD'?undefined:await new Promise((resolve,reject)=>{const chunks=[];request.on('data',chunk=>chunks.push(chunk));request.on('end',()=>resolve(Buffer.concat(chunks)));request.on('error',reject)});
      const prefixLength=isAdminApiRequest?hangoutNowApiPath.length:4;
      const upstream=await fetch(`${proxyApiUrl}${request.url.slice(prefixLength)}`,{method:request.method,headers:{...(request.headers.authorization?{authorization:request.headers.authorization}:{}),...(request.headers['content-type']?{'content-type':request.headers['content-type']}:{}),...(request.headers['x-admin-token']?{'x-admin-token':request.headers['x-admin-token']}:{}),...(request.headers['x-admin-id']?{'x-admin-id':request.headers['x-admin-id']}:{})},body,redirect:'manual'});
      const responseBody=Buffer.from(await upstream.arrayBuffer());
      const location=upstream.headers.get('location');
      response.writeHead(upstream.status,{...securityHeaders,'content-type':upstream.headers.get('content-type')||'application/json; charset=utf-8','cache-control':'no-store',...(location?{location}:{})});
      response.end(responseBody);
    }catch{
      response.writeHead(502,{...securityHeaders,'content-type':'application/json; charset=utf-8'});
      response.end(JSON.stringify({message:'テストAPIへ接続できませんでした'}));
    }
    return;
  }
  if(requestedPath==='/config.js'){
    const config={
      apiUrl:proxyApiUrl?'/api':process.env.API_URL||'http://localhost:3000',
      demoAccounts:{host:{enabled:true},guest:{enabled:true}},
    };
    response.writeHead(200,{...securityHeaders,'content-type':'text/javascript; charset=utf-8','cache-control':'no-store'});
    response.end(`globalThis.HANGOUT_NOW_CONFIG=${JSON.stringify(config)};`);
    return;
  }
  if (requestedPath === '/divertnavi-app/config.js') {
    const mapboxToken = process.env.MAPBOX_APIKEY?.trim() ?? '';
    let dashboardRequest = false;
    try { dashboardRequest = Boolean(divertNaviDashboardPath && new URL(request.headers.referer).pathname.replace(/\/+$/, '') === divertNaviDashboardPath); } catch {}
    const config = {
      mapboxToken,
      ...(dashboardRequest ? { dashboardPath: divertNaviDashboardPath, collectorApiBase: `${divertNaviDashboardPath}/api/collector` } : {}),
    };
    response.writeHead(200, {
      ...securityHeaders,
      'content-type': 'text/javascript; charset=utf-8',
      'cache-control': 'no-store',
    });
    response.end(`globalThis.DIVERTNAVI_CONFIG=${JSON.stringify(config)};`);
    return;
  }
  if (requestedPath === '/coachgo-demo/runtime-config.js') {
    const mapboxAccessToken = process.env.MAPBOX_APIKEY?.trim() ?? '';
    const config = {
      mapboxAccessToken: mapboxAccessToken.startsWith('pk.') ? mapboxAccessToken : null,
      mapDataUrl: null,
      underpassDataUrl: '/coachgo-demo/underpasses.generated.json',
      dataMode: 'DIVERTNAVI_PUBLIC',
    };
    response.writeHead(200, {
      ...securityHeaders,
      'content-type': 'text/javascript; charset=utf-8',
      'cache-control': 'no-store',
    });
    response.end(`globalThis.COACHGO_CONFIG=${JSON.stringify(config)};`);
    return;
  }
  const isHangoutNowAdminPath = normalizedRequestedPath === hangoutNowAdminPath || requestedPath.startsWith(`${hangoutNowAdminPath}/`);
  const staticRoot = isHangoutNowAdminPath ? hangoutNowAdminRoot : root;
  const pathname = isHangoutNowAdminPath
    ? normalizedRequestedPath === hangoutNowAdminPath
      ? '/index.html'
      : requestedPath.slice(hangoutNowAdminPath.length)
    : requestedPath === '/'
    ? '/index.html'
    : requestedPath === '/coachgo-demo' || requestedPath === '/coachgo-demo/'
      ? '/coachgo-demo/index.html'
    : requestedPath === '/divertnavi-app' || requestedPath === '/divertnavi-app/'
      ? '/divertnavi-app/index.html'
    : requestedPath === '/minnade-kaigo' || requestedPath === '/minnade-kaigo/'
      ? '/minnade-kaigo/index.html'
      : divertNaviDashboardPath && normalizedRequestedPath === divertNaviDashboardPath
        ? '/divertnavi-app/index.html'
      : requestedPath;
  const file = normalize(join(staticRoot, pathname));
  if (!file.startsWith(staticRoot)) { response.writeHead(403, securityHeaders).end(); return; }
  try {
    const fileBody = await readFile(file);
    const isApplicationPage = isHangoutNowAdminPath || requestedPath === '/demo.html' || requestedPath === '/app.html' || requestedPath.startsWith('/coachgo-demo') || requestedPath.startsWith('/divertnavi-app') || requestedPath.startsWith('/minnade-kaigo');
    const body = extname(file) === '.html' && !isApplicationPage
      ? Buffer.from(fileBody.toString('utf8').replace('<head>', '<head><link rel="stylesheet" href="/cookie-consent.css?v=20260816-2"><link rel="stylesheet" href="/share.css?v=20260821-2"><script src="/analytics.js?v=20260820-2" defer></script><script src="/attribution.js?v=20260821-2" defer></script><script src="/share.js?v=20260821-3" defer></script>'))
      : fileBody;
    const isVersionedAsset = requestedPath.startsWith('/assets/') || ['.css', '.js', '.svg', '.png', '.jpg', '.jpeg', '.webp'].includes(extname(file));
    response.writeHead(200, {
      ...securityHeaders,
      'content-type': types[extname(file)] ?? 'application/octet-stream',
      'cache-control': isVersionedAsset ? 'public, max-age=86400, stale-while-revalidate=604800' : 'no-cache',
      ...(isApplicationPage ? { 'x-robots-tag': 'noindex, nofollow, noarchive' } : {}),
    });
    response.end(body);
  } catch { if (!response.headersSent) response.writeHead(404, securityHeaders); response.end('Not found'); }
}).listen(port, '0.0.0.0', () => console.log(`Hangout Now demo listening on ${port}`));
