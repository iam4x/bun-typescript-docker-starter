import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { Glob } from "bun";

const notFound = () => new Response("Not Found", { status: 404 });

function bundledAssets(directory: string) {
  const path = join(directory, ".vite/manifest.json");
  const assets = new Set<string>();
  if (!existsSync(path)) return assets;

  const manifest: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error("Invalid Vite build manifest");
  }

  for (const entry of Object.values(manifest)) {
    if (!entry || typeof entry !== "object")
      throw new Error("Invalid Vite manifest entry");
    for (const [field, value] of Object.entries(entry)) {
      if (field !== "file" && field !== "css" && field !== "assets") continue;
      for (const file of Array.isArray(value) ? value : [value]) {
        if (typeof file !== "string")
          throw new Error("Invalid Vite manifest asset");
        assets.add(file);
      }
    }
  }
  return assets;
}

export function createSpaHandler(directory: string) {
  const indexPath = join(directory, "index.html");
  if (!existsSync(indexPath)) return notFound;

  const index = Bun.file(indexPath);
  const bundled = bundledAssets(directory);
  const files = new Map(
    [...new Glob("**/*").scanSync({ cwd: directory, onlyFiles: true })].map(
      (path) => [
        `/${path.split("/").map(encodeURIComponent).join("/")}`,
        {
          body: Bun.file(join(directory, path)),
          cacheControl: bundled.has(path)
            ? "public, max-age=31536000, immutable"
            : "no-cache",
        },
      ],
    ),
  );

  return (request: Request) => {
    if (request.method !== "GET" && request.method !== "HEAD")
      return notFound();

    const pathname = new URL(request.url).pathname;
    const file = files.get(pathname);

    if (file) {
      return new Response(file.body, {
        headers: {
          "Cache-Control": file.cacheControl,
        },
      });
    }

    if (pathname === "/assets" || pathname.startsWith("/assets/")) {
      return notFound();
    }

    if (
      pathname === "/" ||
      request.headers.get("Accept")?.includes("text/html")
    ) {
      return new Response(index, { headers: { "Cache-Control": "no-cache" } });
    }

    return notFound();
  };
}
