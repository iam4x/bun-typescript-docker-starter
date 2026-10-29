# Home and counter

The home page renders in the browser, applies Tailwind styles, and updates a
counter when the user clicks. It fits a mobile viewport.

## Sub-features

- `home-render` displays `Start building.` and `Count is 0`.
- `home-count` increments to 1 and then 2.
- `home-styles` applies the grid layout and 12px vertical button padding.
- `home-mobile` fits a 375px viewport without horizontal scrolling.
- `home-client-only` leaves `#root` empty when JavaScript is disabled.

## How to get to it (user POV)

- Open `/` directly.
- Choose `Home` from the main navigation.
- Choose `Back to home` on the client 404 page.

## Driving it with Playwright

Preconditions: the baseline app is unchanged and `doctor.json` passed.

Run `bun run verify spa`. The helper uses
`getByRole("button", { name: "Count is 0", exact: true }).click()`, clicks
`Count is 1`, and requires `Count is 2`. It records before/after screenshots and
an ARIA snapshot, then checks computed CSS and the mobile layout. A second
browser context disables JavaScript and requires an empty `#root` and no `h1`.
`shell.html` and the trace preserve that check.

## Gotchas

- The counter is in memory. A reload or route remount resets it.
- A screenshot alone does not prove reactivity. Require the recorded clicks and state changes.
- When replacing the demo, update the selectors and expected behavior together. A missing heading is a failed baseline, not a reason to skip rendering checks.
