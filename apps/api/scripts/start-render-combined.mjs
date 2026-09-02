import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import httpProxy from "http-proxy";
import { ROBOCARE_BASE_PATH, targetForRequest } from "./render-router.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const publicPort = Number(process.env.PORT ?? 3000);
const apiPort = Number(process.env.HANGOUTNOW_INTERNAL_PORT ?? 3100);
const robocarePort = Number(process.env.ROBOCARE_INTERNAL_PORT ?? 3101);
const targets = {
  api: `http://127.0.0.1:${apiPort}`,
  robocare: `http://127.0.0.1:${robocarePort}`,
};

if (![publicPort, apiPort, robocarePort].every((port) => Number.isInteger(port) && port > 0 && port < 65_536)) {
  throw new Error("Combined Render service ports must be valid TCP ports.");
}
if (new Set([publicPort, apiPort, robocarePort]).size !== 3) {
  throw new Error("Combined Render service ports must be unique.");
}

function startChild(name, entrypoint, environment) {
  const child = spawn(process.execPath, [entrypoint], {
    cwd: repositoryRoot,
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
});
const children = [api, robocare];
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
  proxy.web(request, response, { target: targetForRequest(request.url, targets) });
});
server.on("upgrade", (request, socket, head) => {
  proxy.ws(request, socket, head, { target: targetForRequest(request.url, targets) });
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

for (const [name, child] of [["HangoutNow API", api], ["RoboCareOne", robocare]]) {
  child.on("exit", (code, signal) => {
    if (!shuttingDown) {
      console.error(`[combined] ${name} stopped unexpectedly (${code ?? signal ?? "unknown"}).`);
      void shutdown(1);
    }
  });
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => void shutdown(0));

try {
  await Promise.all([
    waitForPort(apiPort, "HangoutNow API", api),
    waitForPort(robocarePort, "RoboCareOne", robocare),
  ]);
  server.listen(publicPort, "0.0.0.0", () => {
    console.log(`[combined] HangoutNow API and RoboCareOne are listening on port ${publicPort}.`);
  });
} catch (error) {
  console.error("[combined] startup failed:", error);
  await shutdown(1);
}
