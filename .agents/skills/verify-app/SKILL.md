---
name: verify-app
description: Verify the Bun TypeScript Docker starter and apps generated from it through real HTTP requests and the SolidJS SPA in Chromium. Use after changes to UI behavior, routing, Tailwind, development reloads, builds, or delivery.
---

# Verify the app

Read [the feature map](features/README.md), then the entries affected by the change.
The primary interface is the SolidJS SPA. The Bun HTTP server, Docker image,
and project creation command are additional user interfaces.

## Launch

Run from the project root on Linux, macOS, or WSL with Bun 1.4.4 or newer:

```bash
bun install --frozen-lockfile
bunx playwright install chromium
bun run verify spa
```

The helper copies the current working tree, including uncommitted changes, into
a disposable directory. It excludes dependencies, builds, caches, evidence,
Git metadata, and `.env` files. It installs locked dependencies there, builds
the app, and launches the documented start command on a fresh local port.
There is no database, seed data, or authentication in the starter.

Ready means the owned process is alive, `/health` returns `200 OK`, and `/`
serves the HTML shell. The drive then requires the `Start building.` heading
and a usable counter. An HTTP health check alone does not prove the UI works.

Choose the workflow that matches the change:

```bash
bun run verify server
bun run verify spa
bun run verify dev
```

`server` checks the server-only build. `spa` checks the production app in Chromium.
`dev` checks the development proxy, UI journeys, and live TSX/Tailwind updates.
Each run owns its build directory, dependency cache, port, and browser context.
Concurrent runs do not modify the original checkout or drive an existing server.

If browser downloads are unavailable and Chromium is already installed:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="$(command -v chromium)" bun run verify spa
```

## Doctor

The helper runs its read-only doctor before driving and saves `doctor.json`.
For the most recent run while its process is still alive:

```bash
bun run verify doctor
```

It checks the recorded PID, health response, and expected root response for the
recorded mode. Read `instance.json` for the PID, URL, and disposable workspace.
Do not treat a matching `/health` response as permission to drive another server.
The doctor expects the process started by this run; it does not adopt services.
After cleanup, doctor failure is expected. Start a fresh run when investigating
an old failure. Read `failure.txt`, `server.log`, and `build.log` first.

## Drive

[The executable helper](../../../scripts/verify.ts) uses Playwright roles and
accessible names from the real app. It clicks `Count is 0` and `Count is 1`,
requires `Count is 2`, follows `About`, refreshes `/about`, and returns home
through the client 404 page. It checks computed Tailwind styles, a mobile viewport,
and an empty `#root` with JavaScript disabled. It asserts that no unhandled
browser exception occurred.

The development journey changes only the disposable copy of `client/app.tsx`.
It requires both the changed heading and a newly generated `rounded-[37px]`
utility. Never replace this check with a manual refresh or a CSS file touch.

For Docker and project creation, follow [delivery](features/delivery.md).
Those entry points require separate evidence; a local SPA run does not cover them.

## Evidence

Every run prints its unique directory under `.verification/`. Keep these files:

- `actions.jsonl` records commands and browser actions in order.
- `instance.json`, `doctor.json`, and `http.json` record the launched instance and responses.
- `install.log`, `build.log` when applicable, and `server.log` record process output.
- `home-before.png`, `home-after.png`, `home-mobile.png`, and `home.aria.txt` show counter state and layout.
- `about-reloaded.png` proves the deep-link refresh.
- `shell.html` records the HTML received without JavaScript.
- `browser.trace.zip` records browser actions, network activity, and DOM snapshots.
- `development-updated.png` and `development.aria.txt` prove live updates in dev mode.
- `result.json` states the outcome. `failure.txt` records a failed attempt.
- `cleanup.json` records teardown without removing the proof.

Exercise the user path. Do not substitute internal state setters, mocked routes,
or test-only endpoints. Pair actions with resulting state and verify external
side effects when future features add storage or network writes. Use a dry-run
only after checking what it actually writes or sends. Missing preconditions are
failures or explicit skips, never passes. A run without a passing `result.json`
and successful cleanup is incomplete. Inspect browser console entries in the
action log alongside the assertions.

## Cleanup

The helper closes its browser, terminates only the process groups it created,
and removes its disposable workspace in `finally`, including failed runs.
SIGINT and SIGTERM also request cleanup. It never kills by process name.
Evidence in `.verification/` survives teardown and stays out of Git, Docker
contexts, and newly scaffolded projects.

If the helper itself is forcibly killed, use the recorded `instance.json` and
verify that the PID still belongs to that workspace before terminating its
process group. Remove only that recorded disposable directory. Never delete
the evidence directory as part of cleanup.

## Helpers

The helper is executable and can also run directly:

```bash
./scripts/verify.ts spa
./scripts/verify.ts server
./scripts/verify.ts dev
./scripts/verify.ts doctor
```

To inspect a browser trace:

```bash
bunx playwright show-trace
```

Open one retained `browser.trace.zip` in the trace viewer. The helper and this skill travel
with `bun run create`. As the app grows, update the feature map and corresponding
journeys together. Use `/maintain-verification-skill` to audit them against the
current app. Keep baseline journey failures visible until their replacements
prove the new user behavior.
