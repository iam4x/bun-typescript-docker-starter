import { serve } from "bun";

import { createSpaHandler } from "./spa";

export const routes = {
  "/health": new Response("OK"),
  "/api": new Response("Not Found", { status: 404 }),
  "/api/*": new Response("Not Found", { status: 404 }),
};

export function createServer({
  port = process.env["PORT"] ?? 3000,
  clientDirectory,
}: {
  port?: string | number;
  clientDirectory?: string;
} = {}) {
  return serve({
    port,
    routes,
    development: false,
    fetch: clientDirectory
      ? createSpaHandler(clientDirectory)
      : () => new Response("Not Found", { status: 404 }),
  });
}
