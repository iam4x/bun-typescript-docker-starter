#!/usr/bin/env bun
import assert from "node:assert/strict";
import {
  appendFileSync,
  closeSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import { setTimeout } from "node:timers/promises";

type Mode = "server" | "spa" | "dev";
type Instance = { pid: number; url: string; mode: Mode; workspace: string };
type Child = Pick<Bun.Subprocess, "pid" | "exited" | "exitCode">;

const root = resolve(import.meta.dir, "..");
const evidenceRoot = join(root, ".verification");
const command = process.argv[2] ?? "spa";

function isMode(value: unknown): value is Mode {
  return value === "server" || value === "spa" || value === "dev";
}

async function doctor(instance: Instance) {
  process.kill(instance.pid, 0);
  const health = await fetch(`${instance.url}/health`, {
    signal: AbortSignal.timeout(1000),
  });
  assert.equal(health.status, 200);
  assert.equal(await health.text(), "OK");
  const page = await fetch(instance.url, { signal: AbortSignal.timeout(1000) });
  assert.equal(page.status, instance.mode === "server" ? 404 : 200);
  const body = await page.text();
  if (instance.mode !== "server") assert.match(body, /id="root"/);
  return { ...instance, health: "OK", rootStatus: page.status };
}

if (command === "doctor") {
  const latest = readdirSync(evidenceRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .at(-1);
  const directory = process.argv[3]
    ? resolve(process.argv[3])
    : join(evidenceRoot, latest ?? "missing");
  const data: unknown = await Bun.file(join(directory, "instance.json")).json();
  if (
    !data ||
    typeof data !== "object" ||
    !("pid" in data) ||
    typeof data.pid !== "number" ||
    !("url" in data) ||
    typeof data.url !== "string" ||
    !("workspace" in data) ||
    typeof data.workspace !== "string" ||
    !("mode" in data) ||
    !isMode(data.mode)
  )
    throw new Error("Invalid instance.json. Start a fresh verification run.");
  console.log(
    await doctor({
      pid: data.pid,
      url: data.url,
      mode: data.mode,
      workspace: data.workspace,
    }),
  );
  process.exit(0);
}

if (!isMode(command))
  throw new Error(
    "Usage: bun run verify [server|spa|dev|doctor [evidence-directory]]",
  );
if (process.platform === "win32")
  throw new Error(
    "Verification requires POSIX process groups. Run it in Linux, macOS, or WSL.",
  );

const mode = command;
const evidence = join(
  evidenceRoot,
  `${new Date().toISOString().replaceAll(/[:.]/g, "-")}-${mode}-${crypto.randomUUID().slice(0, 8)}`,
);
mkdirSync(evidence, { recursive: true });
const workspace = mkdtempSync(join(tmpdir(), "bun-app-verify-"));
const children = new Set<Child>();
const cleanupErrors: string[] = [];
let cleaned = false;
let appUrl: string | undefined;

function action(feature: string, detail: string) {
  const entry = `${JSON.stringify({ time: new Date().toISOString(), feature, detail })}\n`;
  appendFileSync(join(evidence, "actions.jsonl"), entry);
}

function launch(args: string[], log: string, env = process.env) {
  action("launch", args.join(" "));
  const fd = openSync(join(evidence, log), "w");
  try {
    const child = Bun.spawn(args, {
      cwd: workspace,
      env,
      stdin: "ignore",
      stdout: fd,
      stderr: fd,
      detached: true,
    });
    children.add(child);
    return child;
  } finally {
    closeSync(fd);
  }
}

async function run(args: string[], log: string, env = process.env) {
  const child = launch(args, log, env);
  const status = await child.exited;
  children.delete(child);
  assert.equal(status, 0, `Command failed. Read ${join(evidence, log)}`);
}

function signalGroup(child: Child, signal: NodeJS.Signals) {
  try {
    process.kill(-child.pid, signal);
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ESRCH"))
      throw error;
  }
}

async function cleanup() {
  if (cleaned) return;
  cleaned = true;
  for (const child of children) {
    try {
      signalGroup(child, "SIGTERM");
      await Promise.race([
        child.exited,
        setTimeout(2000, undefined, { ref: false }),
      ]);
      signalGroup(child, "SIGKILL");
      await child.exited;
    } catch (error) {
      cleanupErrors.push(String(error));
    }
  }
  rmSync(workspace, { recursive: true, force: true });
  if (appUrl) {
    try {
      await fetch(appUrl, { signal: AbortSignal.timeout(1000) });
      cleanupErrors.push("The application still responds after teardown.");
    } catch {
      action("cleanup", "The owned application port no longer responds.");
    }
  }
  await Bun.write(
    join(evidence, "cleanup.json"),
    JSON.stringify({ workspaceRemoved: true, cleanupErrors }, null, 2),
  );
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void cleanup().finally(() => process.exit(130));
  });
}

console.log(`Verification evidence: ${evidence}`);
let passed = false;
try {
  const excluded = new Set([
    ".git",
    "node_modules",
    "dist",
    "coverage",
    ".verification",
    ".cache",
  ]);
  cpSync(root, workspace, {
    recursive: true,
    filter: (source) =>
      !relative(root, source)
        .split(sep)
        .some((part) => excluded.has(part) || part.startsWith(".env")),
  });
  await run([process.execPath, "install", "--frozen-lockfile"], "install.log");
  if (mode !== "dev")
    await run(
      [process.execPath, "run", mode === "spa" ? "build:spa" : "build"],
      "build.log",
    );

  const reservation = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: () => new Response(),
  });
  const port = reservation.port;
  reservation.stop(true);
  const child = launch(
    [process.execPath, "run", mode === "dev" ? "dev:spa" : "start"],
    "server.log",
    { ...process.env, PORT: String(port) },
  );
  const instance: Instance = {
    pid: child.pid,
    url: `http://127.0.0.1:${port}`,
    mode,
    workspace,
  };
  appUrl = instance.url;
  await Bun.write(
    join(evidence, "instance.json"),
    JSON.stringify(instance, null, 2),
  );

  const deadline = Date.now() + 45_000;
  while (true) {
    assert.equal(
      child.exitCode,
      null,
      "The application exited before it became ready. Read server.log.",
    );
    try {
      const result = await doctor(instance);
      await Bun.write(
        join(evidence, "doctor.json"),
        JSON.stringify(result, null, 2),
      );
      break;
    } catch (error) {
      if (Date.now() >= deadline) throw error;
      await Bun.sleep(100);
    }
  }

  const responses = [];
  for (const expected of [
    { path: "/health", status: 200, body: "OK" },
    { path: "/health?probe=1", status: 200, body: "OK" },
    { path: "/api", status: 404, body: "Not Found" },
    { path: "/api?probe=1", status: 404, body: "Not Found" },
    { path: "/api/users", status: 404, body: "Not Found" },
    { path: "/assets/missing.js", status: 404, body: "Not Found" },
  ]) {
    const response = await fetch(`${instance.url}${expected.path}`, {
      headers: { Accept: "text/html" },
    });
    const body = await response.text();
    responses.push({ path: expected.path, status: response.status, body });
    await Bun.write(
      join(evidence, "http.json"),
      JSON.stringify(responses, null, 2),
    );
    assert.equal(response.status, expected.status, expected.path);
    assert.equal(body, expected.body, expected.path);
  }
  action(
    "server",
    "Verified health and API/asset 404s through the public HTTP port.",
  );

  if (mode !== "server") {
    await run(
      [process.execPath, "x", "--bun", "playwright", "test"],
      "browser.log",
      {
        ...process.env,
        VERIFY_URL: instance.url,
        VERIFY_MODE: mode,
        VERIFY_EVIDENCE: evidence,
        VERIFY_WORKSPACE: workspace,
      },
    );
  }

  passed = true;
} catch (error) {
  await Bun.write(
    join(evidence, "failure.txt"),
    error instanceof Error ? (error.stack ?? error.message) : String(error),
  );
  console.error(error);
} finally {
  await cleanup();
}

passed &&= cleanupErrors.length === 0;
await Bun.write(
  join(evidence, "result.json"),
  JSON.stringify({ mode, passed, cleanupErrors }, null, 2),
);
console.log(
  `${passed ? "PASS" : "FAIL"} ${mode}. Evidence retained at ${evidence}`,
);
process.exitCode = passed ? 0 : 1;
