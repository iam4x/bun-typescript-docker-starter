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

Requires Bun 1.4.4 or newer.

To install dependencies:

```bash
bun install
```

To develop:

```bash
bun run dev
```

To run checks:

```bash
bun fmt --check
bun check
bun run lint
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

This project was created using `bun init` in bun v1.2.10. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
