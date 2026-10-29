# App verification map

This map covers the Bun server and optional SolidJS SPA shipped by this starter.
Update it as generated projects replace the demo UI or add features.

## Baseline preconditions

- Install locked dependencies and Playwright Chromium as described in `../SKILL.md`.
- Run `bun run verify spa`, `bun run verify dev`, or `bun run verify server` from the project root.
- The helper starts a disposable copy with a fresh port and browser context.
- No seed data, authentication, or database is required.
- Read the printed evidence directory and its `doctor.json` before assessing a journey.

## Proof and coverage

Read the matching entry before driving a feature. Preserve action logs and
resulting state, including failed attempts. A skipped Docker or scaffold journey
remains unverified even when local browser checks pass. Never weaken assertions
to accommodate missing prerequisites. Report the missing prerequisite and update
the relevant `Gotchas` when it is a lasting constraint.

## Features

| Feature                       | Entry points                                                  | Automated command                                |
| ----------------------------- | ------------------------------------------------------------- | ------------------------------------------------ |
| [Home](home.md)               | `/`, counter, mobile viewport, JavaScript disabled            | `bun run verify spa`                             |
| [Navigation](navigation.md)   | Home and About links, `/about` refresh, unknown nested URL    | `bun run verify spa`                             |
| [Server](server.md)           | server-only startup, SPA startup, `/health`, `/api`, assets   | `bun run verify server` and `bun run verify spa` |
| [Development](development.md) | `bun run dev:spa`, API proxy, TSX edits, new Tailwind classes | `bun run verify dev`                             |
| [Delivery](delivery.md)       | production builds, both Docker modes, `bun run create`        | Follow the delivery recipe                       |

## Extending the map

Keep the four H2s used by existing feature files. Add a row here and a journey
to `scripts/verify.ts` for each new user-facing behavior. Use current accessible
names and routes. Record setup for new auth, seed data, or services. If a feature
sends messages, charges money, or changes shared data, define an authorized test
boundary before automating it.
