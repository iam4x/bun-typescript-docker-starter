import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createServer } from "./server";

const directory = mkdtempSync(join(tmpdir(), "bun-starter-spa-"));
mkdirSync(join(directory, "assets"));
mkdirSync(join(directory, ".vite"));
const html = '<!doctype html><html><body><div id="root"></div></body></html>';
await Bun.write(join(directory, "index.html"), html);
await Bun.write(join(directory, "assets/app-123.js"), 'console.log("client");');
await Bun.write(join(directory, "assets/app-123.css"), "body{margin:0}");
await Bun.write(join(directory, "assets/logo.svg"), "<svg/>");
await Bun.write(
  join(directory, ".vite/manifest.json"),
  JSON.stringify({
    "index.html": { file: "assets/app-123.js", css: ["assets/app-123.css"] },
  }),
);
await Bun.write(join(directory, "robots.txt"), "User-agent: *\nAllow: /\n");
await Bun.write(
  join(directory, "social card.svg"),
  '<svg xmlns="http://www.w3.org/2000/svg"/>',
);

const server = createServer({ port: 0, clientDirectory: directory });
const serverOnly = createServer({ port: 0 });
const missingClient = createServer({
  port: 0,
  clientDirectory: join(directory, "missing"),
});
const htmlHeaders = { Accept: "text/html" };

afterAll(() => {
  server.stop(true);
  serverOnly.stop(true);
  missingClient.stop(true);
  rmSync(directory, { recursive: true, force: true });
});

describe("server-only", () => {
  test("keeps health available", async () => {
    const response = await fetch(new URL("/health", serverOnly.url));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("OK");
  });

  test("returns 404 without a client build", async () => {
    for (const app of [serverOnly, missingClient]) {
      const response = await fetch(new URL("/", app.url), {
        headers: htmlHeaders,
      });
      expect(response.status).toBe(404);
      expect(await response.text()).toBe("Not Found");
    }
  });
});

describe("SPA", () => {
  test("serves the HTML shell for browser navigation and nested routes", async () => {
    for (const path of ["/", "/about", "/users/jane.doe?tab=profile"]) {
      const response = await fetch(new URL(path, server.url), {
        headers: htmlHeaders,
      });
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toContain("text/html");
      expect(response.headers.get("Cache-Control")).toBe("no-cache");
      expect(await response.text()).toBe(html);
    }
  });

  test("serves hashed JS and CSS with immutable caching and MIME types", async () => {
    for (const { path, type, body } of [
      {
        path: "/assets/app-123.js?v=1",
        type: "javascript",
        body: 'console.log("client");',
      },
      { path: "/assets/app-123.css", type: "text/css", body: "body{margin:0}" },
    ]) {
      const response = await fetch(new URL(path, server.url));
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toContain(type);
      expect(response.headers.get("Cache-Control")).toBe(
        "public, max-age=31536000, immutable",
      );
      expect(await response.text()).toBe(body);
    }
  });

  test("does not turn missing assets, API requests, or POSTs into HTML", async () => {
    for (const path of [
      "/assets",
      "/assets/missing.js",
      "/api",
      "/api/users",
    ]) {
      const response = await fetch(new URL(path, server.url), {
        headers: htmlHeaders,
      });
      expect(response.status).toBe(404);
      expect(await response.text()).toBe("Not Found");
    }

    const response = await fetch(new URL("/about", server.url), {
      method: "POST",
      headers: htmlHeaders,
    });
    expect(response.status).toBe(404);
  });

  test("serves public files without immutable caching", async () => {
    for (const { path, body } of [
      { path: "/robots.txt", body: "User-agent: *\nAllow: /\n" },
      { path: "/assets/logo.svg", body: "<svg/>" },
      {
        path: "/social%20card.svg",
        body: '<svg xmlns="http://www.w3.org/2000/svg"/>',
      },
      { path: "/index.html", body: html },
    ]) {
      const response = await fetch(new URL(path, server.url));
      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe("no-cache");
      expect(await response.text()).toBe(body);
    }
  });

  test("does not return HTML for non-navigation fetches", async () => {
    const response = await fetch(new URL("/missing.js", server.url));
    expect(response.status).toBe(404);
  });

  test("supports HEAD requests without a body", async () => {
    for (const path of ["/about", "/assets/app-123.js"]) {
      const response = await fetch(new URL(path, server.url), {
        method: "HEAD",
        headers: htmlHeaders,
      });
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("");
    }
  });

  test("does not expose files outside the client build", async () => {
    const response = await fetch(
      new URL("/assets/%2e%2e%2findex.html", server.url),
    );
    expect(response.status).toBe(404);
  });

  test("keeps health outside the SPA fallback", async () => {
    const response = await fetch(new URL("/health", server.url), {
      headers: htmlHeaders,
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("OK");
  });
});
