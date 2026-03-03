const path = require("node:path");
const { spawn } = require("node:child_process");

const NEXT_SUBCOMMANDS = new Set(["build", "dev", "info", "lint", "start", "telemetry"]);

function buildNextArgs(args = []) {
  if (args.length === 0) {
    return ["dev"];
  }

  if (args[0].startsWith("-")) {
    return ["dev", ...args];
  }

  if (NEXT_SUBCOMMANDS.has(args[0])) {
    return args;
  }

  return ["dev", ...args];
}

function resolvePackageRoot() {
  return path.resolve(__dirname, "..");
}

function resolveNextBin(packageRoot = resolvePackageRoot()) {
  return require.resolve("next/dist/bin/next", { paths: [packageRoot] });
}

function run(args = [], options = {}) {
  const packageRoot = options.packageRoot || resolvePackageRoot();
  const nextBin = options.nextBin || resolveNextBin(packageRoot);
  const nextArgs = buildNextArgs(args);
  const spawnImpl = options.spawnImpl || spawn;
  const env = options.env || process.env;

  const child = spawnImpl(process.execPath, [nextBin, ...nextArgs], {
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
  resolveNextBin,
  resolvePackageRoot,
  run,
};
