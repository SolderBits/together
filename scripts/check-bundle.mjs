/**
 * What actually ships.
 *
 *   npm run check:bundle
 *
 * A secret that stays in `.env.local` is safe by accident; what matters is
 * whether the build put it in a file a browser downloads. Reading the source
 * and concluding it looks fine is the weak version of this check — so this one
 * writes known values into the environment, builds, and then goes looking for
 * them in the output. If any turns up, the build is the leak.
 *
 * It also refuses a build that carries development-only affordances into
 * production: the console handles that exist to diagnose a connection are not
 * something to hand every visitor.
 */
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const ENV = join(ROOT, ".env.local");
const STASH = join(ROOT, ".env.local.check-bundle-stash");

/** Values a build has no business emitting. Distinctive enough to grep for. */
const CANARIES = {
  SESSION_SECRET: "CANARY_SESSION_SECRET_5f2b9c1e7a4d8e3b6c0f9a2d5e8b1c4f",
  SESSION_SECRET_PREVIOUS: "CANARY_PREVIOUS_SECRET_9a3c7e1b5d0f8462ae19c3b7d5f0248a",
  DATABASE_URL: "postgres://canaryuser:CANARY_DB_PASSWORD_ab73f1@db.internal:5432/canary",
  R2_ACCESS_KEY_ID: "CANARY_R2_ACCESS_KEY_ID_71c3e9",
  R2_SECRET_ACCESS_KEY: "CANARY_R2_SECRET_ACCESS_KEY_4d0b8a2f6e",
  R2_ACCOUNT_ID: "CANARY_R2_ACCOUNT_1d9f",
  R2_BUCKET: "canary-bucket",
  ANTHROPIC_API_KEY: "sk-ant-CANARY-0000000000000000000000",
};

/** Public by design: these are supposed to reach the browser. */
const PUBLIC = { NEXT_PUBLIC_WS_URL: "wss://canary.example.com/ws" };

/** Things that should never appear in browser-served code, canaries aside. */
const FORBIDDEN_PATTERNS = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "a private key"],
  [/postgres(ql)?:\/\/[^"'`\s]*:[^"'`\s]*@/, "a database URL with credentials"],
  [/service_role/, "a Supabase service-role reference"],
  [/sk-ant-[A-Za-z0-9-]{16}/, "an Anthropic API key"],
  [/__togetherSocket/, "the development socket handle"],
  [/__togetherConnection/, "the development connection handle"],
];

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(js|mjs|css|json|map|html|txt)$/.test(entry)) out.push(full);
  }
  return out;
}

const problems = [];
const stashed = existsSync(ENV);

try {
  if (stashed) renameSync(ENV, STASH);
  writeFileSync(
    ENV,
    Object.entries({ ...CANARIES, ...PUBLIC })
      .map(([k, v]) => `${k}=${v}`)
      .join("\n") + "\n",
  );

  rmSync(join(ROOT, ".next"), { recursive: true, force: true });
  rmSync(join(ROOT, "dist"), { recursive: true, force: true });
  console.log("  building with canary secrets in the environment…");
  execSync("npm run build", { cwd: ROOT, stdio: "pipe" });

  // Everything under .next/static is served to browsers verbatim.
  const clientFiles = walk(join(ROOT, ".next", "static"));
  console.log(`  scanning ${clientFiles.length} browser-served files`);

  for (const file of clientFiles) {
    const text = readFileSync(file, "utf8");
    const shown = file.replace(ROOT + "/", "");

    for (const [name, value] of Object.entries(CANARIES)) {
      if (text.includes(value)) problems.push(`${name} reached the browser bundle — ${shown}`);
    }
    for (const [pattern, what] of FORBIDDEN_PATTERNS) {
      if (pattern.test(text)) problems.push(`${what} is in the browser bundle — ${shown}`);
    }
  }

  // The public one must be there, or this scan proves nothing: a build that
  // inlined no environment at all would pass everything above trivially.
  const sawPublic = clientFiles.some((f) => readFileSync(f, "utf8").includes(PUBLIC.NEXT_PUBLIC_WS_URL));
  if (!sawPublic) {
    problems.push(
      "NEXT_PUBLIC_WS_URL is absent from the browser bundle — the scan cannot " +
        "distinguish a build that keeps secrets out from one that inlines nothing",
    );
  } else {
    console.log("  the public value is present, so inlining did happen");
  }

  // The server bundle reads its configuration at runtime; a literal in there
  // would mean a secret baked into an image.
  const serverBundle = join(ROOT, "dist", "server.mjs");
  if (existsSync(serverBundle)) {
    const text = readFileSync(serverBundle, "utf8");
    for (const [name, value] of Object.entries(CANARIES)) {
      if (text.includes(value)) problems.push(`${name} was baked into dist/server.mjs`);
    }

    /*
     * Every package the bundle still imports has to be installed where it runs.
     * A production install omits devDependencies, so an external that lives
     * there builds and tests perfectly here and then fails to boot on the
     * platform — the one failure mode local work cannot show you. This caught
     * exactly that with `ws`.
     */
    const manifest = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    const production = new Set(Object.keys(manifest.dependencies ?? {}));
    const imported = new Set(
      [...text.matchAll(/^import\s[^;]*?from\s*"([^"]+)"/gm)]
        .map((m) => m[1])
        .filter((s) => !s.startsWith(".") && !s.startsWith("node:"))
        // @scope/name, or name — a deep import belongs to its package.
        .map((s) => (s.startsWith("@") ? s.split("/").slice(0, 2).join("/") : s.split("/")[0])),
    );
    for (const name of imported) {
      if (!production.has(name)) {
        problems.push(
          `dist/server.mjs imports "${name}", which is not a production dependency — ` +
            "an install with --omit=dev would boot straight into ERR_MODULE_NOT_FOUND",
        );
      }
    }
    console.log(`  server bundle imports ${imported.size} package(s)`);
  }
} finally {
  rmSync(ENV, { force: true });
  if (stashed) renameSync(STASH, ENV);
}

if (problems.length) {
  console.log("\nThe build leaks:");
  for (const p of [...new Set(problems)]) console.log(`  - ${p}`);
  process.exit(1);
}
console.log("\nNo secret reached the browser bundle, and no development handles shipped.");
