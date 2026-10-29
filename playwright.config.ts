import { join } from "node:path";

import { defineConfig } from "@playwright/test";

const evidence = process.env["VERIFY_EVIDENCE"];
if (!evidence) throw new Error("Use bun run verify spa or bun run verify dev.");

export default defineConfig({
  testDir: "./scripts/verification",
  testMatch: "browser.spec.ts",
  outputDir: join(evidence, "browser"),
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: "list",
  use: {
    browserName: "chromium",
    trace: "on",
    screenshot: "only-on-failure",
    launchOptions: {
      executablePath: process.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH"],
    },
  },
});
