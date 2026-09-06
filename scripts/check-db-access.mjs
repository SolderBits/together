/**
 * Structural guard: the database has exactly one door.
 *
 *   node scripts/check-db-access.mjs
 *
 * RLS gave us a property that application code does not get for free — forget a
 * filter and it returns nothing, rather than everything. Replacing it with
 * helper functions only works if the helpers cannot be bypassed, and "everyone
 * remembers to use them" is not a mechanism.
 *
 * So this fails the test run if anything outside `lib/server/db/` touches the
 * driver, and if anything inside it builds SQL out of a template literal that
 * interpolates a value. It runs in `npm test`, which means it gates the build
 * rather than a review — a lint rule someone can disable with a comment would
 * be weaker.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Only these files may import the driver or the pool. */
const DATA_LAYER = join("lib", "server", "db");

/** These may import the driver because they are not the application. */
const ALLOWED_OUTSIDE = [
  join("db", "migrate.mjs"),
  join("scripts", "check-db-access.mjs"),
  join("supabase", "rls.test.mjs"),
  join("supabase", "rls.live.test.mjs"),
];

const SEARCH_DIRS = ["app", "components", "lib", "db", "server", "scripts"];
const EXTENSIONS = [".ts", ".tsx", ".mjs", ".js"];

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry === "node_modules" || entry === ".next" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXTENSIONS.some((e) => entry.endsWith(e))) out.push(full);
  }
  return out;
}

const files = SEARCH_DIRS.flatMap((d) => walk(join(root, d)));
const violations = [];

for (const file of files) {
  const rel = relative(root, file);
  if (ALLOWED_OUTSIDE.includes(rel)) continue;

  const source = readFileSync(file, "utf8");
  const inDataLayer = rel.startsWith(DATA_LAYER + sep);

  const lines = source.split("\n");
  lines.forEach((line, i) => {
    const at = `${rel}:${i + 1}`;

    // --- outside the data layer: no driver, no pool ------------------------
    if (!inDataLayer) {
      if (/\bfrom\s+["']pg["']|\brequire\(["']pg["']\)/.test(line)) {
        violations.push([at, "imports the `pg` driver outside lib/server/db/"]);
      }
      if (/from\s+["']@\/lib\/server\/db\/pool["']/.test(line)) {
        violations.push([at, "imports the connection pool outside lib/server/db/"]);
      }
      // A raw SQL verb against something that looks like a client.
      if (/\.query\s*\(\s*[`"']\s*(select|insert|update|delete)\b/i.test(line)) {
        violations.push([at, "runs SQL outside lib/server/db/"]);
      }
    }

    // --- inside the data layer: no interpolated values --------------------
    if (inDataLayer) {
      // A template literal containing ${...} that also contains a SQL verb.
      // Identifier constants (ROOM_TTL, table names from a closed union) are
      // deliberate and named, so they are allowed by exception below.
      if (/[`].*\b(select|insert|update|delete|from|where)\b.*\$\{/i.test(line)) {
        const interpolated = line.match(/\$\{([^}]*)\}/g) ?? [];
        const allowed = interpolated.every((expr) =>
          /\$\{\s*(ROOM_TTL|table|column)\s*\}/.test(expr),
        );
        if (!allowed) {
          violations.push([at, `interpolates into SQL: ${interpolated.join(", ")}`]);
        }
      }
    }
  });
}

// --- the client bundle must never see a server secret ----------------------
const SERVER_ONLY_ENV = [
  "DATABASE_URL",
  "SESSION_SECRET",
  "SESSION_SECRET_PREVIOUS",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "ANTHROPIC_API_KEY",
];

for (const file of files) {
  const rel = relative(root, file);
  if (ALLOWED_OUTSIDE.includes(rel)) continue;
  const source = readFileSync(file, "utf8");
  if (!/^"use client"|^'use client'/m.test(source)) continue;

  for (const name of SERVER_ONLY_ENV) {
    if (new RegExp(`process\\.env\\.${name}\\b`).test(source)) {
      violations.push([rel, `reads server-only ${name} from a client component`]);
    }
  }
}

// --- nothing server-only may hide behind a NEXT_PUBLIC_ name --------------
const envExample = join(root, ".env.example");
try {
  for (const line of readFileSync(envExample, "utf8").split("\n")) {
    const m = /^\s*(NEXT_PUBLIC_[A-Z0-9_]+)\s*=/.exec(line);
    if (!m) continue;
    if (/SECRET|PASSWORD|PRIVATE|SERVICE_ROLE|ACCESS_KEY|DATABASE_URL/i.test(m[1])) {
      violations.push([".env.example", `${m[1]} exposes a secret-shaped name to the browser`]);
    }
  }
} catch {
  violations.push([".env.example", "missing"]);
}

if (violations.length) {
  console.log(`\n${violations.length} violation(s):\n`);
  for (const [where, why] of violations) console.log(`  ${where}\n    ${why}`);
  console.log(
    "\nThe database is reachable only through lib/server/db/, which is what makes the\n" +
      "authorization gates unbypassable. Route this through a function there instead.\n",
  );
  process.exit(1);
}

console.log(`  ok    database access confined to lib/server/db/ (${files.length} files checked)`);
console.log("  ok    no interpolated values in SQL");
console.log("  ok    no server-only env read from a client component");
console.log("  ok    no secret-shaped NEXT_PUBLIC_ name");
