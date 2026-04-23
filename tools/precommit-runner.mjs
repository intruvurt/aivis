import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const START_TS = Date.now();
const JSON_PREFIX = "[precommit.event]";

function emit(event) {
  const payload = {
    ts: new Date().toISOString(),
    ...event,
  };
  console.log(`${JSON_PREFIX} ${JSON.stringify(payload)}`);
}

function runCommand(step, command, args, opts = {}) {
  const startedAt = Date.now();
  emit({
    event: `quality.${step}`,
    state: "started",
    step,
    command,
    args,
    files: opts.files ?? [],
  });

  const result = spawnSync(command, args, {
    stdio: "inherit",
    timeout: opts.timeoutMs,
  });

  const durationMs = Date.now() - startedAt;
  const failed = result.status !== 0 || result.signal;

  emit({
    event: `quality.${step}`,
    state: failed ? "failed" : "passed",
    step,
    exit_code: result.status ?? 1,
    signal: result.signal ?? null,
    duration_ms: durationMs,
    files: opts.files ?? [],
    file_count: (opts.files ?? []).length,
    impact: failed ? "blocking" : "none",
  });

  if (failed) {
    process.exit(result.status ?? 1);
  }
}

function gitStagedFiles() {
  const res = spawnSync(
    "git",
    ["diff", "--cached", "--name-only", "--diff-filter=ACMR"],
    {
      encoding: "utf8",
    },
  );

  if (res.status !== 0) {
    emit({
      event: "quality.precommit",
      state: "failed",
      step: "git.diff",
      impact: "blocking",
      message: "Unable to read staged files",
    });
    process.exit(res.status ?? 1);
  }

  return res.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((file) => existsSync(file));
}

function isLintable(file) {
  return /\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(file);
}

function isFormattable(file) {
  return /\.(ts|tsx|js|jsx|mjs|cjs|json|css|md|yml|yaml)$/i.test(file);
}

function stripPrefix(file, prefix) {
  return file.startsWith(prefix) ? file.slice(prefix.length) : file;
}

const stagedFiles = gitStagedFiles();
const clientTouched =
  stagedFiles.some((f) => f.startsWith("client/")) ||
  stagedFiles.some((f) => f.startsWith("shared/"));
const serverTouched =
  stagedFiles.some((f) => f.startsWith("server/")) ||
  stagedFiles.some((f) => f.startsWith("shared/"));

const clientLintFiles = stagedFiles
  .filter((f) => f.startsWith("client/"))
  .filter(isLintable)
  .map((f) => stripPrefix(f, "client/"));

const serverLintFiles = stagedFiles
  .filter((f) => f.startsWith("server/"))
  .filter(isLintable)
  .map((f) => stripPrefix(f, "server/"));

const formatFiles = stagedFiles.filter(isFormattable);

emit({
  event: "quality.precommit",
  state: "started",
  step: "precommit",
  files: stagedFiles,
  file_count: stagedFiles.length,
});

if (stagedFiles.length === 0) {
  emit({
    event: "quality.precommit",
    state: "passed",
    step: "precommit",
    message: "No staged files; skipping checks.",
    duration_ms: Date.now() - START_TS,
  });
  process.exit(0);
}

if (clientLintFiles.length > 0) {
  runCommand(
    "lint.client",
    "npm",
    [
      "--prefix",
      "client",
      "exec",
      "--",
      "eslint",
      "--config",
      "eslint.config.cjs",
      "--ext",
      ".ts,.tsx",
      ...clientLintFiles,
    ],
    { files: clientLintFiles.map((f) => `client/${f}`) },
  );
}

if (serverLintFiles.length > 0) {
  runCommand(
    "lint.server",
    "npm",
    [
      "--prefix",
      "server",
      "exec",
      "--",
      "eslint",
      "--config",
      "eslint.config.cjs",
      "--ext",
      ".ts",
      ...serverLintFiles,
    ],
    { files: serverLintFiles.map((f) => `server/${f}`) },
  );
}

if (formatFiles.length > 0) {
  runCommand(
    "format.check",
    "npm",
    ["--prefix", "client", "exec", "--", "prettier", "--check", ...formatFiles],
    { files: formatFiles },
  );
}

if (clientTouched) {
  runCommand("typecheck.client", "npm", [
    "--prefix",
    "client",
    "run",
    "typecheck",
  ]);
}

if (serverTouched) {
  runCommand("typecheck.server", "npm", [
    "--prefix",
    "server",
    "run",
    "typecheck",
  ]);
}

if (clientTouched) {
  runCommand(
    "test.client",
    "npm",
    ["--prefix", "client", "test", "--", "--run"],
    { timeoutMs: 10 * 60 * 1000 },
  );
}

if (serverTouched) {
  runCommand("test.server", "npm", ["--prefix", "server", "test"], {
    timeoutMs: 10 * 60 * 1000,
  });
}

emit({
  event: "quality.precommit",
  state: "passed",
  step: "precommit",
  duration_ms: Date.now() - START_TS,
  file_count: stagedFiles.length,
});
