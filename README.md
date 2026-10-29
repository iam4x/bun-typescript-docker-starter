# bun-typescript-docker-starter

<!-- scaffold:start -->

## Create a new project from this boilerplate

```bash
bun run create <project-name> [target-dir]
```

This copies the boilerplate (respecting `.gitignore`) into `target-dir` (defaults to `../<project-name>`), replaces `bun-typescript-docker-starter` with your project name in `package.json`, `bun.lock` and `README.md`, then runs `git init`, `bun install` and creates an initial commit.

Options:

- `--no-install`: skip `bun install`
- `--no-git`: skip `git init` and the initial commit

<!-- scaffold:end -->

Requires Bun 1.4.4 or newer. The default build runs a Bun server. Opt into the
SolidJS SPA when your project needs a frontend.

To install dependencies:

```bash
bun install
```

## Develop the server

```bash
bun run dev
```

The server listens on port 3000. Set `PORT` to change it. `/health` returns `OK`.
Add API routes to `src/server.ts`. The `/api` namespace stays outside the SPA
fallback in both development and production.

## Develop the SPA

```bash
bun run dev:spa
```

Open http://localhost:3000. Edit `client/app.tsx` to change the app. Vite updates
the browser when you edit client code or styles. The development command starts
the Bun backend on an internal port and proxies `/api` and `/health` through
Vite. Use relative URLs such as `/api/users` for API requests.

The frontend uses SolidJS 1.9.17, the latest stable release at setup, Solid Router,
TypeScript with TSX, and Tailwind CSS 4.3.3. `/` includes a reactive counter.
`/about` demonstrates browser routing and direct-link refreshes. Add routes in
`client/app.tsx` and Tailwind styles in `client/styles.css`.
Put files that need stable URLs, such as `robots.txt`, in `client/public`.

Solid mounts into an empty `#root` through `render` in `client/index.tsx`. The
server serves a static HTML shell. It never renders Solid components or hydrates
server-generated markup.

Bun runs the backend and build tooling. Vite bundles the SPA with
`vite-plugin-solid` and `@tailwindcss/vite`, including Solid Fast Refresh and
Tailwind updates during development. Bun's bundler was tested on 1.4.4, but both
Tailwind integrations kept stale CSS after adding classes to TSX. Vite handles
that dependency tracking without a custom watcher.

Only environment variables prefixed with `PUBLIC_` are inlined into client code.
Read them as `import.meta.env["PUBLIC_API_URL"]`, for example. These values are public
and fixed when you build. Server environment variables remain runtime values.

## Build and run

For a server-only build:

```bash
bun run build
bun start
```

For a server with the SPA:

```bash
bun run build:spa
bun start
```

Both commands clean `dist` first. Switching to a server-only build removes any
previous SPA output. The SPA build puts the server in `dist/index.js` and client
files in `dist/client`. `bun start` serves the client files when they exist.

Browser navigation to a client route serves `index.html`. Unknown API routes,
missing assets, and unsupported methods return 404. Hashed assets use immutable
caching. The HTML shell uses `Cache-Control: no-cache` so new deployments can
point browsers to updated assets.

## Run in Docker

For a server-only image:

```bash
docker build -t my-app .
docker run --rm -p 3000:3000 my-app
```

To include the SPA in the same image:

```bash
docker build --build-arg SPA=true -t my-app .
docker run --rm -p 3000:3000 my-app
```

The build stage installs dependencies and builds the selected app. The runtime
image runs as the `bun` user and includes only Bun, `package.json`, and the
compiled output. Build tools and `node_modules` stay in the build stage.

## Run checks

```bash
bun fmt --check
bun check
bun run lint
bun test
bun run build
bun run build:spa
```

To format files:

```bash
bun fmt
```

To fix lint issues:

```bash
bun run lint:fix
```

Bun formats files and checks TypeScript types. Oxlint enforces the lint rules in
`.oxlintrc.json`, including type-aware linting.

The pre-commit hook formats staged files, runs Oxlint, checks types, and runs tests.

## Verify user behavior

The project-local `verify-app` skill lives in `.agents/skills/verify-app/SKILL.md`.
It and its feature map are copied into projects created from this boilerplate.

```bash
bunx playwright install chromium
bun run verify spa
bun run verify dev
bun run verify server
```

Each command uses a disposable copy with an isolated build and port, then stops
its processes and removes the copy. Screenshots, Playwright traces, HTTP results,
and command logs remain in the printed directory under `.verification/`.
Update the feature map and verification journeys as you replace the demo app.
Use `/maintain-verification-skill` to audit that coverage as the project grows.
