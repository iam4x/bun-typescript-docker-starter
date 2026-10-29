import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const outdir = join(root, "dist");

rmSync(outdir, { recursive: true, force: true });
mkdirSync(outdir, { recursive: true });

const server = await Bun.build({
  entrypoints: [join(root, "src/index.ts")],
  outdir,
  target: "bun",
  env: "disable",
});

if (!server.success)
  throw new AggregateError(server.logs, "Server build failed");

if (process.argv.includes("--spa")) {
  const { build } = await import("vite");
  await build({ configFile: join(root, "vite.config.ts") });
}
