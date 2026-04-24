#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const action = process.argv[2] ?? "config";
const passthrough = process.argv.slice(3);

const runtimes = [
  {
    name: "docker",
    composeArgs: ["compose"],
  },
  {
    name: "podman",
    composeArgs: ["compose"],
  },
];

function hasBinary(bin) {
  const result = spawnSync(bin, ["--version"], { stdio: "ignore" });
  return result.status === 0;
}

function resolveRuntime() {
  for (const runtime of runtimes) {
    if (hasBinary(runtime.name)) {
      return runtime;
    }
  }
  return null;
}

const runtime = resolveRuntime();
if (!runtime) {
  console.error(
    "No supported container runtime found. Install Podman (recommended) or Docker.",
  );
  process.exit(1);
}

const actionMap = {
  config: ["config"],
  build: ["build"],
  up: ["up", "-d"],
  down: ["down"],
  logs: ["logs", "-f"],
};

const mapped = actionMap[action];
if (!mapped) {
  console.error(`Unsupported action: ${action}`);
  process.exit(1);
}

const args = [...runtime.composeArgs, ...mapped, ...passthrough];
const result = spawnSync(runtime.name, args, { stdio: "inherit" });
if (typeof result.status === "number") {
  process.exit(result.status);
}
process.exit(1);
