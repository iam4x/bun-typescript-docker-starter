# Builds, Docker, and project creation

Users can build either deployment mode and create a new project that retains
the verification tooling.

## Sub-features

- `delivery-server` produces a server-only build.
- `delivery-spa` produces a server and client build together.
- `delivery-switch` removes stale client output when switching to a server-only build.
- `delivery-docker` runs both Docker image variants without runtime dependencies.
- `delivery-create` copies the skill and helper into a generated project.

## How to get to it (user POV)

- Run `bun run build` or `bun run build:spa`, then `bun start`.
- Run `docker build` with or without `--build-arg SPA=true`.
- Run `bun run create` with a project name and destination.

## Driving it with the verification helper and Docker

Preconditions: Docker is available for the Docker journey. Run builds and project
creation in a disposable directory so an existing project's `dist` is untouched.

- Local builds. Run `bun run verify server` and `bun run verify spa`; retain both evidence directories.
- Switching. In a disposable project, run `bun run build:spa`, then `bun run build`, and require that `dist/client` no longer exists. Record command output and the file check.
- Docker. Build both variants with unique image tags, launch containers with `--name` set to unique names and `-p 127.0.0.1::3000`, and record their IDs and assigned ports with `docker port`. Require `/health` to return `OK` in both. Require `/` to return 404 in server-only mode. In SPA mode, follow the home and navigation recipes in Chromium, including the `/about` refresh. Require `/api/users` to remain 404. Save HTTP responses, screenshots, logs, image IDs, and `docker inspect` output showing which image ran. Use `docker exec` to require that `/app/node_modules` is absent and the runtime user is `bun`. Stop only the recorded container IDs and retain the evidence.
- Project creation. Use `bun run create verification-copy /tmp/verification-copy --no-git` only when that destination is absent or empty. In the generated project, require `.agents/skills/verify-app/SKILL.md` and executable `scripts/verify.ts`, run `bun run verify spa`, and retain its passing evidence outside the generated directory before deleting the copy. Require that previous `.verification` runs were not copied from the template.

## Gotchas

- Local build success does not prove the Docker entry point, runtime user, or image contents.
- Choose a fresh scaffold destination when `/tmp/verification-copy` already exists; do not clear someone else's directory.
- `--no-install` skips dependency setup, not just Git initialization. Install locked dependencies before verification if using it.
- Docker and scaffold journeys are manual map entries. Report them as unverified until their own actions and outcomes are recorded.
- Preserve proof artifacts before deleting a generated project or its temporary parent directory.
