#!/usr/bin/env bun
import type { Browser, BrowserContext } from "@playwright/test";

import assert from "node:assert/strict";
import {
  closeSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  rmSync,
  writeSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";

import { chromium, expect } from "@playwright/test";

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
const children: Child[] = [];
const cleanupErrors: string[] = [];
let browser: Browser | undefined;
let context: BrowserContext | undefined;
let cleaned = false;
let appUrl: string | undefined;

function action(feature: string, detail: string) {
  const entry = `${JSON.stringify({ time: new Date().toISOString(), feature, detail })}\n`;
  const fd = openSync(join(evidence, "actions.jsonl"), "a");
  try {
    writeSync(fd, entry);
  } finally {
    closeSync(fd);
  }
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
    children.push(child);
    return child;
  } finally {
    closeSync(fd);
  }
}

async function run(args: string[], log: string) {
  const child = launch(args, log);
  assert.equal(
    await child.exited,
    0,
    `Command failed. Read ${join(evidence, log)}`,
  );
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
  if (context) {
    try {
      await context.tracing.stop({ path: join(evidence, "browser.trace.zip") });
    } catch (error) {
      cleanupErrors.push(String(error));
    }
  }
  if (browser) {
    try {
      await browser.close();
    } catch (error) {
      cleanupErrors.push(String(error));
    }
  }
  for (const child of children) {
    try {
      signalGroup(child, "SIGTERM");
      await Promise.race([child.exited, Bun.sleep(2000)]);
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
  for (const path of ["/health", "/api", "/api/users", "/assets/missing.js"]) {
    const response = await fetch(`${instance.url}${path}`, {
      headers: { Accept: path.startsWith("/assets/") ? "*/*" : "text/html" },
    });
    const body = await response.text();
    responses.push({ path, status: response.status, body });
    await Bun.write(
      join(evidence, "http.json"),
      JSON.stringify(responses, null, 2),
    );
    assert.equal(response.status, path === "/health" ? 200 : 404, path);
    if (path !== "/assets/missing.js")
      assert.equal(body, path === "/health" ? "OK" : "Not Found");
  }
  action(
    "server",
    "Verified health and API/asset 404s through the public HTTP port.",
  );

  if (mode !== "server") {
    browser = await chromium.launch({
      ...(process.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH"]
        ? { executablePath: process.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH"] }
        : {}),
    });
    context = await browser.newContext();
    await context.tracing.start({ screenshots: true, snapshots: true });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) =>
      action("browser-console", `${message.type()}: ${message.text()}`),
    );
    await page.goto(instance.url);
    await expect(
      page.getByRole("heading", { name: "Start building.", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: join(evidence, "home-before.png"),
      fullPage: true,
    });
    action("home", "Click Count is 0, then Count is 1.");
    await page.getByRole("button", { name: "Count is 0", exact: true }).click();
    await page.getByRole("button", { name: "Count is 1", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Count is 2", exact: true }),
    ).toBeVisible();
    assert.equal(
      await page
        .locator("main")
        .evaluate((element) => getComputedStyle(element).display),
      "grid",
    );
    assert.equal(
      await page
        .getByRole("button")
        .evaluate((element) => getComputedStyle(element).paddingTop),
      "12px",
    );
    await page.screenshot({
      path: join(evidence, "home-after.png"),
      fullPage: true,
    });
    await Bun.write(
      join(evidence, "home.aria.txt"),
      await page.locator("body").ariaSnapshot(),
    );

    action(
      "navigation",
      "Choose About, reload /about, then visit an unknown nested route.",
    );
    await page.getByRole("link", { name: "About", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "About this starter", exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Home", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Start building.", exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "About", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "About this starter", exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "About this starter", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: join(evidence, "about-reloaded.png"),
      fullPage: true,
    });
    await page.goto(`${instance.url}/nested/unknown/path`);
    await expect(
      page.getByRole("heading", { name: "Page not found", exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Back to home", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Start building.", exact: true }),
    ).toBeVisible();
    await page.setViewportSize({ width: 375, height: 812 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.screenshot({
      path: join(evidence, "home-mobile.png"),
      fullPage: true,
    });

    const noJS = await browser.newContext({ javaScriptEnabled: false });
    try {
      const shell = await noJS.newPage();
      const response = await shell.goto(instance.url);
      assert.equal(response?.status(), 200);
      await expect(shell.locator("#root")).toBeEmpty();
      await expect(shell.locator("h1")).toHaveCount(0);
      await Bun.write(join(evidence, "shell.html"), await response.text());
      action(
        "home",
        "With JavaScript disabled, #root is empty and no heading is rendered.",
      );
    } finally {
      await noJS.close();
    }

    if (mode === "dev") {
      const source = Bun.file(join(workspace, "client/app.tsx"));
      const original = await source.text();
      assert.ok(
        original.includes("Start building.") &&
          original.includes("grid min-h-screen"),
        "Update the development feature recipe for the current app.",
      );
      action(
        "development",
        "In the disposable copy, change the heading and add rounded-[37px] to main.",
      );
      await Bun.write(
        source,
        original
          .replace("Start building.", "Reload verified.")
          .replace("grid min-h-screen", "rounded-[37px] grid min-h-screen"),
      );
      await expect(
        page.getByRole("heading", { name: "Reload verified.", exact: true }),
      ).toBeVisible({ timeout: 15_000 });
      await expect(page.locator("main")).toHaveCSS("border-radius", "37px", {
        timeout: 15_000,
      });
      await page.screenshot({
        path: join(evidence, "development-updated.png"),
        fullPage: true,
      });
      await Bun.write(
        join(evidence, "development.aria.txt"),
        await page.locator("body").ariaSnapshot(),
      );
    }
    assert.deepEqual(errors, [], "Unhandled browser exceptions");
    await Bun.write(
      join(evidence, "browser-errors.json"),
      JSON.stringify(errors),
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
