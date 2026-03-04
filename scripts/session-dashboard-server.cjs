#!/usr/bin/env node

const http = require("node:http");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const chokidar = require("chokidar");
const next = require("next");
const { WebSocketServer } = require("ws");

const DEFAULT_PORT = 3000;
const DEFAULT_HOSTNAME = "0.0.0.0";
const MAX_PORT_PROBE_ATTEMPTS = 20;
const HEARTBEAT_INTERVAL_MS = 30_000;
const WS_OPEN = 1;
const CLAUDE_BASE = path.join(os.homedir(), ".claude", "projects");
const CODEX_BASE = path.join(os.homedir(), ".codex", "sessions");
const WATCH_PATTERNS = [
  path.join(CLAUDE_BASE, "**/*.jsonl"),
  path.join(CODEX_BASE, "**/*.jsonl"),
];
const UUID_FILE_RE = /([a-f0-9-]{36})\.jsonl$/i;

function resolvePackageRoot() {
  return path.resolve(__dirname, "..");
}

function parseServerArgs(args = []) {
  if (args.length === 0) {
    return {
      mode: "dev",
      nextArgs: [],
    };
  }

  const [first, ...rest] = args;
  if (first === "dev" || first === "start") {
    return {
      mode: first,
      nextArgs: rest,
    };
  }

  return {
    mode: "dev",
    nextArgs: args,
  };
}

function isRealtimeUpgradePath(value = "") {
  try {
    const url = new URL(value, "http://localhost");
    return url.pathname === "/api/realtime";
  } catch {
    return false;
  }
}

function readFlag(args, longName, shortName) {
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === longName || value === shortName) {
      return args[index + 1];
    }

    if (value.startsWith(`${longName}=`)) {
      return value.slice(longName.length + 1);
    }
  }

  return undefined;
}

function resolvePort(nextArgs = []) {
  const raw = readFlag(nextArgs, "--port", "-p") ?? process.env.PORT;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PORT;
}

function resolveHostname(nextArgs = []) {
  return readFlag(nextArgs, "--hostname", "-H") ?? process.env.HOSTNAME ?? DEFAULT_HOSTNAME;
}

function checkPortAvailable(hostname, port) {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();

    probe.once("error", (error) => {
      if (error && error.code === "EADDRINUSE") {
        resolve(false);
        return;
      }

      reject(error);
    });

    probe.once("listening", () => {
      probe.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }

        resolve(true);
      });
    });

    probe.listen(port, hostname);
  });
}

async function findAvailablePort(startPort, options = {}) {
  const hostname = options.hostname ?? DEFAULT_HOSTNAME;
  const maxAttempts = options.maxAttempts ?? MAX_PORT_PROBE_ATTEMPTS;
  const isPortAvailable = options.isPortAvailable
    ?? ((candidate) => checkPortAvailable(hostname, candidate));

  for (let offset = 0; offset < maxAttempts; offset += 1) {
    const candidate = startPort + offset;
    if (await isPortAvailable(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Could not find an available port between ${startPort} and ${startPort + maxAttempts - 1}.`
  );
}

function toJson(event) {
  return JSON.stringify(event);
}

function deriveSessionId(filePath) {
  const match = String(filePath).match(UUID_FILE_RE);
  if (!match) {
    return null;
  }

  const prefix = String(filePath).startsWith(CLAUDE_BASE) ? "cc" : "cdx";
  return `${prefix}-${match[1]}`;
}

function createRealtimeHub() {
  const clients = new Set();
  let watcher = null;
  let heartbeatTimer = null;

  function removeClient(client) {
    clients.delete(client);
  }

  function send(client, event) {
    if (client.readyState !== WS_OPEN) {
      removeClient(client);
      return;
    }

    try {
      client.send(toJson(event));
    } catch {
      removeClient(client);
    }
  }

  function broadcast(event) {
    for (const client of clients) {
      send(client, event);
    }
  }

  function ensureHeartbeat() {
    if (heartbeatTimer) {
      return;
    }

    heartbeatTimer = setInterval(() => {
      for (const client of clients) {
        if (client.isAlive === false) {
          try {
            client.terminate();
          } catch {
            // noop
          }
          removeClient(client);
          continue;
        }

        client.isAlive = false;
        try {
          client.ping();
        } catch {
          removeClient(client);
        }
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  function ensureWatcher() {
    if (watcher) {
      return watcher;
    }

    broadcast({ type: "scan_started", scope: "all" });

    watcher = chokidar.watch(WATCH_PATTERNS, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
    });

    watcher.on("ready", () => {
      broadcast({ type: "scan_progress", scope: "all", completed: 1, total: 1 });
    });

    watcher.on("error", () => {
      broadcast({ type: "warning", message: "实时监听出现异常，正在等待下一次文件更新。" });
    });

    const handleChange = (filePath) => {
      broadcast({ type: "projects_dirty" });
      broadcast({ type: "sessions_dirty" });

      const sessionId = deriveSessionId(filePath);
      if (sessionId) {
        broadcast({ type: "session_dirty", sessionId });
      }
    };

    watcher.on("add", handleChange);
    watcher.on("change", handleChange);
    watcher.on("unlink", handleChange);

    return watcher;
  }

  function attach(client) {
    clients.add(client);
    client.isAlive = true;

    client.on("pong", () => {
      client.isAlive = true;
    });

    client.on("close", () => {
      removeClient(client);
    });

    client.on("error", () => {
      removeClient(client);
    });

    ensureHeartbeat();
    ensureWatcher();
    send(client, { type: "connected" });
  }

  async function close() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }

    if (watcher) {
      await watcher.close();
      watcher = null;
    }

    for (const client of clients) {
      try {
        client.close();
      } catch {
        // noop
      }
    }

    clients.clear();
  }

  return {
    attach,
    broadcast,
    close,
  };
}

async function createAppServer(args = [], options = {}) {
  const packageRoot = options.packageRoot || resolvePackageRoot();
  const { mode, nextArgs } = parseServerArgs(args);
  const hostname = resolveHostname(nextArgs);
  const requestedPort = resolvePort(nextArgs);
  const port = await findAvailablePort(requestedPort, { hostname });
  const dev = mode === "dev";
  const app = next({
    dev,
    dir: packageRoot,
    hostname,
    port,
  });
  const handle = app.getRequestHandler();
  const hub = createRealtimeHub();

  await app.prepare();

  const handleUpgrade = typeof app.getUpgradeHandler === "function"
    ? app.getUpgradeHandler()
    : null;
  const wss = new WebSocketServer({ noServer: true });
  const server = http.createServer((request, response) => handle(request, response));

  wss.on("connection", (client) => {
    hub.attach(client);
  });

  server.on("upgrade", (request, socket, head) => {
    if (isRealtimeUpgradePath(request.url || "")) {
      wss.handleUpgrade(request, socket, head, (client) => {
        wss.emit("connection", client, request);
      });
      return;
    }

    if (handleUpgrade) {
      handleUpgrade(request, socket, head);
      return;
    }

    socket.destroy();
  });

  return {
    server,
    wss,
    hub,
    mode,
    requestedPort,
    port,
    hostname,
  };
}

async function run(args = [], options = {}) {
  const runtime = await createAppServer(args, options);
  const publicHost = runtime.hostname === "0.0.0.0" ? "localhost" : runtime.hostname;
  const portNote = runtime.port === runtime.requestedPort
    ? ""
    : ` (requested ${runtime.requestedPort} was busy)`;

  runtime.server.listen(runtime.port, runtime.hostname, () => {
    console.log(`[session-dashboard] Ready on http://${publicHost}:${runtime.port}${portNote}`);
  });

  const shutdown = async () => {
    await runtime.hub.close();
    runtime.wss.close();
    runtime.server.close(() => {
      process.exit(0);
    });
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  return runtime;
}

if (require.main === module) {
  run(process.argv.slice(2)).catch((error) => {
    console.error("[session-dashboard] Failed to start:", error);
    process.exit(1);
  });
}

module.exports = {
  createAppServer,
  findAvailablePort,
  isRealtimeUpgradePath,
  parseServerArgs,
  resolvePackageRoot,
  run,
};
