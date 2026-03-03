const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const NEXT_SUBCOMMANDS = new Set(["build", "dev", "info", "lint", "start", "telemetry"]);
const CUSTOM_SERVER_SUBCOMMANDS = new Set(["dev", "start"]);

function hasBuildOutput(packageRoot = resolvePackageRoot()) {
  return (
    fs.existsSync(path.join(packageRoot, ".next", "BUILD_ID")) ||
    fs.existsSync(path.join(packageRoot, ".next", "build", "package.json"))
  );
}

function resolveDefaultSubcommand(packageRoot = resolvePackageRoot()) {
  return hasBuildOutput(packageRoot) ? "start" : "dev";
}

function buildNextArgs(args = [], options = {}) {
  const packageRoot = options.packageRoot || resolvePackageRoot();
  const defaultSubcommand = resolveDefaultSubcommand(packageRoot);

  if (args.length === 0) {
    return [defaultSubcommand];
  }

  if (args[0].startsWith("-")) {
    return [defaultSubcommand, ...args];
  }

  if (NEXT_SUBCOMMANDS.has(args[0])) {
    return args;
  }

  return [defaultSubcommand, ...args];
}

function resolvePackageRoot() {
  return path.resolve(__dirname, "..");
}

function resolveNextBin(packageRoot = resolvePackageRoot()) {
  return require.resolve("next/dist/bin/next", { paths: [packageRoot] });
}

function resolveServerBin(packageRoot = resolvePackageRoot()) {
  return path.join(packageRoot, "scripts", "session-dashboard-server.cjs");
}

function run(args = [], options = {}) {
  const packageRoot = options.packageRoot || resolvePackageRoot();
  const nextBin = options.nextBin || resolveNextBin(packageRoot);
  const serverBin = options.serverBin || resolveServerBin(packageRoot);
  const nextArgs = buildNextArgs(args, { packageRoot });
  const launchBin = CUSTOM_SERVER_SUBCOMMANDS.has(nextArgs[0]) ? serverBin : nextBin;
  const spawnImpl = options.spawnImpl || spawn;
  const env = options.env || process.env;

  const child = spawnImpl(process.execPath, [launchBin, ...nextArgs], {
    cwd: packageRoot,
    env,
    stdio: "inherit",
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });

  child.on("error", (error) => {
    console.error("[session-dashboard] Failed to launch Next.js:", error.message);
    process.exit(1);
  });

  return child;
}

module.exports = {
  buildNextArgs,
  hasBuildOutput,
  resolveNextBin,
  resolveDefaultSubcommand,
  resolvePackageRoot,
  resolveServerBin,
  run,
};
