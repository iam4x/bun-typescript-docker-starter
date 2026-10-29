import assert from "node:assert/strict";
import { appendFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

test("client rendering, counter, routes, styles, and development updates", async ({
  page,
  browser,
}) => {
  const url = process.env["VERIFY_URL"];
  const evidence = process.env["VERIFY_EVIDENCE"];
  const workspace = process.env["VERIFY_WORKSPACE"];
  const development = process.env["VERIFY_MODE"] === "dev";
  assert.ok(
    url && evidence && workspace,
    "Use bun run verify spa or bun run verify dev.",
  );
  const action = (feature: string, detail: string) => {
    appendFileSync(
      join(evidence, "actions.jsonl"),
      `${JSON.stringify({ time: new Date().toISOString(), feature, detail })}\n`,
    );
  };
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) =>
    action("browser-console", `${message.type()}: ${message.text()}`),
  );
  await page.goto(url);
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
  await page.goto(`${url}/nested/unknown/path`);
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
    const response = await shell.goto(url);
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

  if (development) {
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
});
