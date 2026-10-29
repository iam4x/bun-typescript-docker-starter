# Server and static delivery

The Bun server runs on its own or serves the built SPA. Health and API paths
remain separate from browser navigation.

## Sub-features

- `server-health` returns status 200 and body `OK` from `/health`.
- `server-only` returns 404 from `/` without client output.
- `server-api` returns 404 from the unimplemented `/api` and `/api/users` paths.
- `server-assets` serves built JS and CSS with their correct MIME types and immutable caching.
- `server-shell` serves navigation HTML with `Cache-Control: no-cache`.
- `server-missing` returns 404 for missing assets and unsupported methods.
- `server-public` serves stable public files without immutable caching.

## How to get to it (user POV)

- Run `bun run build` and `bun start` for the server alone.
- Run `bun run build:spa` and `bun start` for the server with a frontend.
- Request `/health`, `/api`, or a built asset over HTTP.

## Driving it with HTTP and Playwright

Preconditions: dependencies install from the lockfile. No extra services are needed.

Run `bun run verify server`, then `bun run verify spa`. Both run the public
HTTP paths and retain `http.json`; the latter also loads real hashed assets in
Chromium. Run `bun test` for exact MIME/cache headers, HEAD responses, public
files, encoded filenames, POST rejection, and path traversal behavior against
real ephemeral HTTP servers. Retain that command's output alongside the run
evidence when these behaviors change.

## Gotchas

- Browser fallback depends on `Accept: text/html` for nested URLs. Include that header in HTTP navigation probes.
- New API implementations should replace the baseline 404 assertions with their real public contract.
- `bun run build` deletes previous SPA output. Use the disposable verification copy when testing build switching.
