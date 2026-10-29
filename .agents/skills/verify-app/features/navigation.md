# Client navigation and deep links

Users can follow the main navigation, refresh a nested route, and recover from
an unknown URL without losing access to the app.

## Sub-features

- `nav-about` follows the `About` link to `About this starter`.
- `nav-home` returns through the `Home` link.
- `nav-refresh` refreshes `/about` successfully.
- `nav-missing` displays `Page not found` for `/nested/unknown/path`.
- `nav-prefix` keeps `/apiary` and `/healthcare` as browser routes rather than proxying them to the backend.
- `nav-recover` follows `Back to home` to the working home page.

## How to get to it (user POV)

- Choose `Home` or `About` in the navigation named `Main`.
- Open `/about` directly or refresh it.
- Open an unknown nested URL, then choose `Back to home`.

## Driving it with Playwright

Preconditions: a production SPA or development instance passed its doctor.

Run `bun run verify spa`, and repeat with `bun run verify dev` when changing
development routing. Use `getByRole("link", { name: "About", exact: true })`,
require the about heading, call `page.reload()`, and require the heading again.
The helper also follows `Home` from `/about`, requires the home heading, and
returns through `About` before the refresh.
Visit `/nested/unknown/path`, require `Page not found`, then click `Back to home`
and require `Start building.`. The helper saves `about-reloaded.png` and a trace.

## Gotchas

- The client 404 page receives the SPA HTML with HTTP 200. API and missing asset URLs must still receive HTTP 404.
- A client link click does not prove direct-link refreshes. Keep both journeys.
- Server-only mode intentionally has no client routes.
