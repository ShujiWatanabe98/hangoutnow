import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import httpProxy from "http-proxy";
import { ROBOCARE_BASE_PATH, rewriteUrlForRoute, routeForRequest } from "./render-router.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const publicPort = Number(process.env.PORT ?? 3000);
const apiPort = Number(process.env.HANGOUTNOW_INTERNAL_PORT ?? 3100);
const robocarePort = Number(process.env.ROBOCARE_INTERNAL_PORT ?? 3101);
const demoPort = Number(process.env.METHODMORE_DEMO_INTERNAL_PORT ?? 3102);
const salonrecordPort = Number(process.env.SALONRECORD_INTERNAL_PORT ?? 3103);
const aiocrPort = Number(process.env.AIOCR_INTERNAL_PORT ?? 3104);
const sharedDatabaseUrl = process.env.METHODMORE_SHARED_DATABASE_URL?.trim() || process.env.DATABASE_URL;
const targets = {
  api: `http://127.0.0.1:${apiPort}`,
  robocare: `http://127.0.0.1:${robocarePort}`,
  demo: `http://127.0.0.1:${demoPort}`,
  salonrecord: `http://127.0.0.1:${salonrecordPort}`,
  aiocr: `http://127.0.0.1:${aiocrPort}`,
};

const ports = [publicPort, apiPort, robocarePort, demoPort, salonrecordPort, aiocrPort];
if (!ports.every((port) => Number.isInteger(port) && port > 0 && port < 65_536)) {
  throw new Error("Combined Render service ports must be valid TCP ports.");
}
if (new Set(ports).size !== ports.length) {
  throw new Error("Combined Render service ports must be unique.");
}
if (!sharedDatabaseUrl) throw new Error("A shared production DATABASE_URL is required.");

function startChild(name, entrypoint, environment, cwd = repositoryRoot) {
  const child = spawn(process.execPath, [entrypoint], {
    cwd,
    env: { ...process.env, ...environment },
    stdio: "inherit",
    shell: false,
  });
  child.on("error", (error) => {
    console.error(`[combined] ${name} failed to start:`, error);
  });
  return child;
}

function waitForPort(port, name, child, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      if (child.exitCode !== null || child.signalCode !== null) {
        reject(new Error(`${name} exited before becoming ready.`));
        return;
      }
      const socket = net.createConnection({ host: "127.0.0.1", port });
      socket.setTimeout(1_000);
      socket.once("connect", () => {
        socket.destroy();
        resolve();
      });
      const retry = () => {
        socket.destroy();
        if (Date.now() >= deadline) reject(new Error(`${name} did not listen on port ${port} within ${timeoutMs}ms.`));
        else setTimeout(attempt, 250);
      };
      socket.once("error", retry);
      socket.once("timeout", retry);
    };
    attempt();
  });
}

const api = startChild("HangoutNow API", path.join(repositoryRoot, "apps/api/dist/src/main.js"), {
  PORT: String(apiPort),
});
const robocare = startChild("RoboCareOne", path.join(repositoryRoot, "apps/roboreha/scripts/start.mjs"), {
  PORT: String(robocarePort),
  DB_SCHEMA: process.env.ROBOREHA_DB_SCHEMA?.trim() || "roboreha",
  NEXT_PUBLIC_ROBOREHA_BASE_PATH: ROBOCARE_BASE_PATH,
  ROBOREHA_VIDEO_STORAGE_MODE: process.env.ROBOREHA_VIDEO_STORAGE_MODE?.trim() || "local",
}, path.join(repositoryRoot, "apps/roboreha"));
const demo = startChild("MethodMore Website", path.join(repositoryRoot, "apps/demo/server.mjs"), {
  DEMO_PORT: String(demoPort),
  DEMO_PROXY_API_URL: targets.api,
  API_URL: targets.api,
  ROBOREHA_ROUTE_PATH: ROBOCARE_BASE_PATH,
  ROBOREHA_UPSTREAM_ORIGIN: targets.robocare,
});
const salonrecord = startChild("SalonRecord", path.join(repositoryRoot, "apps/salonrecord/server.js"), {
  PORT: String(salonrecordPort),
  DATABASE_URL: sharedDatabaseUrl,
}, path.join(repositoryRoot, "apps/salonrecord"));
const aiocr = startChild("Standalone AI OCR", path.join(repositoryRoot, "apps/aiocr/standalone/server.mjs"), {
  AIOCR_PORT: String(aiocrPort),
  AIOCR_HOST: "127.0.0.1",
  AIOCR_BASE_PATH: "/ai-ocr",
  DATABASE_URL: sharedDatabaseUrl,
}, path.join(repositoryRoot, "apps/aiocr"));
const childServices = [
  ["HangoutNow API", api, apiPort],
  ["RoboCareOne", robocare, robocarePort],
  ["MethodMore Website", demo, demoPort],
  ["SalonRecord", salonrecord, salonrecordPort],
  ["Standalone AI OCR", aiocr, aiocrPort],
];
const children = childServices.map(([, child]) => child);
let shuttingDown = false;

const proxy = httpProxy.createProxyServer({ xfwd: true, ws: true });
proxy.on("error", (error, request, response) => {
  console.error("[combined] upstream proxy error:", error.message);
  if (response && "writeHead" in response && !response.headersSent) {
    response.writeHead(502, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
    response.end("Service temporarily unavailable.");
  } else if (response && "destroy" in response) {
    response.destroy();
  }
});

const server = http.createServer((request, response) => {
  const route = routeForRequest(request);
  request.url = rewriteUrlForRoute(request.url, route);
  proxy.web(request, response, { target: targets[route] });
});
server.on("upgrade", (request, socket, head) => {
  const route = routeForRequest(request);
  request.url = rewriteUrlForRoute(request.url, route);
  proxy.ws(request, socket, head, { target: targets[route] });
});

async function shutdown(exitCode) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (server.listening) server.close();
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
  }
  const forceExit = setTimeout(() => process.exit(exitCode), 8_000);
  forceExit.unref();
  await Promise.all(children.map((child) => new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) resolve();
    else child.once("exit", resolve);
  })));
  process.exit(exitCode);
}

for (const [name, child] of childServices) {
  child.on("exit", (code, signal) => {
    if (!shuttingDown) {
      console.error(`[combined] ${name} stopped unexpectedly (${code ?? signal ?? "unknown"}).`);
      void shutdown(1);
    }
  });
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => void shutdown(0));

try {
  await Promise.all(childServices.map(([name, child, port]) => waitForPort(port, name, child)));
  server.listen(publicPort, "0.0.0.0", () => {
    console.log(`[combined] MethodMore Platform is listening on port ${publicPort}.`);
  });
} catch (error) {
  console.error("[combined] startup failed:", error);
  await shutdown(1);
}
