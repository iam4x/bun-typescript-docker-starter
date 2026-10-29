# Development updates

Editing TSX updates the app, and adding a Tailwind class generates the new CSS
without a manual refresh. The browser reaches the Bun backend through Vite.

## Sub-features

- `dev-ui` starts the documented development command and renders the app.
- `dev-proxy` forwards `/health` and `/api` to the Bun backend.
- `dev-tsx` updates a visible heading after a source edit.
- `dev-tailwind` generates a newly introduced arbitrary utility.

## How to get to it (user POV)

- Run `bun run dev:spa`, then open the printed URL.
- Edit `client/app.tsx` while the page is open.
- Request relative API URLs through the frontend port.

## Driving it with Playwright

Preconditions: the baseline source contains `Start building.` and
`grid min-h-screen`; Playwright Chromium is available.

Run `bun run verify dev`. After the UI and proxy journeys, the helper edits
only its isolated copy. It changes `Start building.` to `Reload verified.` and
adds `rounded-[37px]` to `main`. Require the new heading and computed
`border-radius: 37px` without reloading the page. The trace,
`development-updated.png`, and `development.aria.txt` preserve the result.

## Gotchas

- Existing utility classes do not prove Tailwind invalidation. Introduce a new class and inspect its computed style.
- Do not touch the original checkout or manually refresh to make this pass.
- Missing source markers fail the journey. Update the recipe when the starter UI changes.
- Frontend reload checks do not cover changing a backend route while the server is running. Add that journey when backend watch behavior changes.
