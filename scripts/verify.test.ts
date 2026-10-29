import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test.skipIf(process.platform === "win32")(
  "finishes teardown when SIGTERM arrives during cleanup",
  async () => {
    const probe = mkdtempSync(join(tmpdir(), "verify-signal-"));
    const preload = join(probe, "signal.mjs");
    let workspace: string | undefined;
    try {
      await Bun.write(
        preload,
        `
const originalKill = process.kill.bind(process);
let sent = false;
process.kill = (pid, signal) => {
  if (!sent && pid < 0 && signal === "SIGTERM") {
    sent = true;
    originalKill(process.pid, "SIGTERM");
  }
  return originalKill(pid, signal);
};
`,
      );
      const child = Bun.spawn(
        [process.execPath, "--preload", preload, "scripts/verify.ts", "server"],
        { cwd: join(import.meta.dir, ".."), stdout: "pipe", stderr: "pipe" },
      );
      const [status, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ]);
      expect(status, stderr).toBe(130);
      const evidence = stdout.match(/Verification evidence: (.+)/)?.[1];
      expect(evidence, stdout).toBeDefined();
      if (!evidence)
        throw new Error("The helper did not report its evidence directory");
      const instance: unknown = await Bun.file(
        join(evidence, "instance.json"),
      ).json();
      if (
        !instance ||
        typeof instance !== "object" ||
        !("workspace" in instance) ||
        typeof instance.workspace !== "string"
      ) {
        throw new Error("The helper did not record its workspace");
      }
      workspace = instance.workspace;
      expect(workspace.startsWith(join(tmpdir(), "bun-app-verify-"))).toBe(
        true,
      );
      const cleanup = Bun.file(join(evidence, "cleanup.json"));
      expect(await cleanup.exists()).toBe(true);
      expect(await cleanup.json()).toEqual({
        workspaceRemoved: true,
        cleanupErrors: [],
      });
      expect(existsSync(workspace)).toBe(false);
    } finally {
      if (workspace?.startsWith(join(tmpdir(), "bun-app-verify-")))
        rmSync(workspace, { recursive: true, force: true });
      rmSync(probe, { recursive: true, force: true });
    }
  },
  60_000,
);
