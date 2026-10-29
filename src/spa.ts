import { existsSync } from "node:fs";
import { join } from "node:path";

import { Glob } from "bun";

const notFound = () => new Response("Not Found", { status: 404 });

export function createSpaHandler(directory: string) {
  const indexPath = join(directory, "index.html");
  if (!existsSync(indexPath)) return notFound;

  const index = Bun.file(indexPath);
  const files = new Map(
    [...new Glob("**/*").scanSync({ cwd: directory, onlyFiles: true })].map(
      (path) => [
        `/${path.split("/").map(encodeURIComponent).join("/")}`,
        Bun.file(join(directory, path)),
      ],
    ),
  );

  return (request: Request) => {
    if (request.method !== "GET" && request.method !== "HEAD")
      return notFound();

    const pathname = new URL(request.url).pathname;
    const file = files.get(pathname);

    if (file) {
      return new Response(file, {
        headers: {
          "Cache-Control": pathname.startsWith("/assets/")
            ? "public, max-age=31536000, immutable"
            : "no-cache",
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
