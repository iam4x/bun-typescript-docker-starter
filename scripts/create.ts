import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";

import { $ } from "bun";

const TEMPLATE_NAME = "bun-typescript-docker-starter";
const TEMPLATE_ROOT = path.resolve(import.meta.dir, "..");

// Files that belong to the scaffold tooling and must not end up in new projects
const SCAFFOLD_FILES = new Set(["scripts/create.ts"]);
const IGNORED_DIRS = new Set([".git", "node_modules", "dist", "coverage"]);

// Files where the template name gets replaced by the new project name
const RENAME_FILES = new Set(["package.json", "bun.lock", "README.md"]);

const usage = `Usage: bun run create <project-name> [target-dir] [--no-install] [--no-git]

  project-name   npm-compatible package name (e.g. my-app or @scope/my-app)
  target-dir     destination folder (defaults to ../<project-name>)`;

const args = process.argv.slice(2);
const flags = new Set(args.filter((arg) => arg.startsWith("--")));
const [projectName, targetArg] = args.filter((arg) => !arg.startsWith("--"));

if (!projectName || flags.has("--help")) {
  console.log(usage);
  process.exit(projectName ? 0 : 1);
}

if (
  !/^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(projectName)
) {
  console.error(
    `Invalid project name "${projectName}", it must be a valid npm package name.`,
  );
  process.exit(1);
}

const targetDir = path.resolve(
  targetArg ??
    path.join(TEMPLATE_ROOT, "..", projectName.replace(/^@[^/]+\//, "")),
);

if (existsSync(targetDir) && readdirSync(targetDir).length > 0) {
  console.error(
    `Target directory ${targetDir} already exists and is not empty.`,
  );
  process.exit(1);
}

const listTemplateFiles = async () => {
  // Prefer git so .gitignore is respected, fallback to a plain directory walk
  const git = await $`git ls-files --cached --others --exclude-standard`
    .cwd(TEMPLATE_ROOT)
    .quiet()
    .nothrow();

  if (git.exitCode === 0) {
    return git.stdout.toString().split("\n").filter(Boolean);
  }

  return readdirSync(TEMPLATE_ROOT, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) =>
      path.relative(TEMPLATE_ROOT, path.join(entry.parentPath, entry.name)),
    )
    .filter(
      (file) => !file.split(path.sep).some((part) => IGNORED_DIRS.has(part)),
    );
};

const transform = (file: string, content: string) => {
  let result = content.replaceAll(TEMPLATE_NAME, projectName);

  if (file === "package.json") {
    const pkg = JSON.parse(result);
    delete pkg.scripts.create;
    result = `${JSON.stringify(pkg, null, 2)}\n`;
  }

  if (file === "README.md") {
    result = result.replace(
      /<!-- scaffold:start -->[\s\S]*?<!-- scaffold:end -->\n*/g,
      "",
    );
  }

  return result;
};

const files = (await listTemplateFiles()).filter(
  (file) => !SCAFFOLD_FILES.has(file),
);

mkdirSync(targetDir, { recursive: true });

for (const file of files) {
  const source = path.join(TEMPLATE_ROOT, file);
  const destination = path.join(targetDir, file);

  // Tracked files deleted from the working tree are still listed by git
  if (!existsSync(source)) continue;

  mkdirSync(path.dirname(destination), { recursive: true });

  if (RENAME_FILES.has(file)) {
    await Bun.write(
      destination,
      transform(file, await Bun.file(source).text()),
    );
  } else {
    copyFileSync(source, destination);
  }
}

console.log(`Created ${projectName} in ${targetDir} (${files.length} files)`);

if (!flags.has("--no-git")) {
  await $`git init --quiet`.cwd(targetDir);
}

if (!flags.has("--no-install")) {
  await $`bun install`.cwd(targetDir);
}

if (!flags.has("--no-git")) {
  const message = `chore: init ${projectName}`;
  await $`git add -A && git commit --quiet --no-verify -m ${message}`
    .cwd(targetDir)
    .nothrow();
}

const relativeDir = path.relative(process.cwd(), targetDir);
const cdPath = relativeDir.startsWith("..") ? targetDir : relativeDir || ".";

console.log(`\nDone! Next steps:\n\n  cd ${cdPath}\n  bun run dev\n`);
