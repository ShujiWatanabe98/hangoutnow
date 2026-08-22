import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const port = Number(process.env.DEMO_PORT ?? 4173);
const root = join(import.meta.dirname, 'public');
const proxyApiUrl = (process.env.DEMO_PROXY_API_URL || process.env.API_URL)?.replace(/\/$/, '');
const dashboardPathCandidate = process.env.DIVERTNAVI_DASHBOARD_PATH?.trim().replace(/\/+$/, '') ?? '';
const divertNaviDashboardPath = /^\/divertnavi-app\/[a-z0-9](?:[a-z0-9-]{22,}[a-z0-9])$/.test(dashboardPathCandidate) ? dashboardPathCandidate : '';
const divertNaviCollector = divertNaviDashboardPath ? import('./divertnavi-collector/service.mjs') : null;
const weathernewsRadarUrl = 'https://wxtech.weathernews.com/api/v1/tile/prec';
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
const securityHeaders = {
  'content-security-policy': "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://api.mapbox.com https://*.tiles.mapbox.com https://tilecache.rainviewer.com https://hangoutnow-demo.onrender.com https://play.google.com https://tools.applemediaservices.com; frame-src https://maps.google.com; connect-src 'self' https://api.mapbox.com https://events.mapbox.com https://*.tiles.mapbox.com https://api.rainviewer.com https://tilecache.rainviewer.com https://api.open-meteo.com https://www.google-analytics.com https://region1.google-analytics.com; font-src 'self'; worker-src blob:; upgrade-insecure-requests",
  'cross-origin-opener-policy': 'same-origin-allow-popups',
  'permissions-policy': 'camera=(self), geolocation=(self), microphone=()',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
};

createServer(async (request, response) => {
  const requestedPath = request.url?.split('?')[0] ?? '/';
  const normalizedRequestedPath = requestedPath.replace(/\/+$/, '') || '/';
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
  if(proxyApiUrl&&requestedPath.startsWith('/api/')){
    try{
      const body=request.method==='GET'||request.method==='HEAD'?undefined:await new Promise((resolve,reject)=>{const chunks=[];request.on('data',chunk=>chunks.push(chunk));request.on('end',()=>resolve(Buffer.concat(chunks)));request.on('error',reject)});
      const upstream=await fetch(`${proxyApiUrl}${request.url.slice(4)}`,{method:request.method,headers:{...(request.headers.authorization?{authorization:request.headers.authorization}:{}),...(request.headers['content-type']?{'content-type':request.headers['content-type']}:{})},body,redirect:'manual'});
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
  const pathname = requestedPath === '/'
    ? '/index.html'
    : requestedPath === '/divertnavi-app' || requestedPath === '/divertnavi-app/'
      ? '/divertnavi-app/index.html'
      : divertNaviDashboardPath && normalizedRequestedPath === divertNaviDashboardPath
        ? '/divertnavi-app/index.html'
      : requestedPath;
  const file = normalize(join(root, pathname));
  if (!file.startsWith(root)) { response.writeHead(403, securityHeaders).end(); return; }
  try {
    const fileBody = await readFile(file);
    const isApplicationPage = requestedPath === '/demo.html' || requestedPath === '/app.html' || requestedPath.startsWith('/divertnavi-app');
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
