import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const port = Number(process.env.DEMO_PORT ?? 4173);
const root = join(import.meta.dirname, 'public');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };

createServer(async (request, response) => {
  const requestedPath = request.url?.split('?')[0] ?? '/';
  if(requestedPath==='/config.js'){
    const config={
      apiUrl:process.env.API_URL||'http://localhost:3000',
      demoAccounts:{
        host:{email:process.env.HANGOUTNOW_DEMO_HOST_EMAIL||'demo-host@hangoutnow.example',password:process.env.HANGOUTNOW_DEMO_PASSWORD||'HangoutNow-Demo-2026!'},
        guest:{email:process.env.HANGOUTNOW_DEMO_GUEST_EMAIL||'demo-guest@hangoutnow.example',password:process.env.HANGOUTNOW_DEMO_PASSWORD||'HangoutNow-Demo-2026!'},
      },
    };
    response.writeHead(200,{'content-type':'text/javascript; charset=utf-8','cache-control':'no-store'});
    response.end(`globalThis.HANGOUT_NOW_CONFIG=${JSON.stringify(config)};`);
    return;
  }
  const pathname = requestedPath === '/' ? '/index.html' : requestedPath;
  const file = normalize(join(root, pathname));
  if (!file.startsWith(root)) { response.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    response.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    response.end(body);
  } catch { if (!response.headersSent) response.writeHead(404); response.end('Not found'); }
}).listen(port, '0.0.0.0', () => console.log(`Hangout Now demo listening on ${port}`));
