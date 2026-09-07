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

function walk(dir, out = [], extensions = EXTENSIONS) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry === "node_modules" || entry === ".next" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out, extensions);
    else if (extensions.some((e) => entry.endsWith(e))) out.push(full);
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

// --- no credential may be committed as a literal ---------------------------
/*
 * `.env.local` is ignored and `.env.example` holds only empty placeholders, so
 * a secret can realistically only arrive here by being pasted into source. A
 * grep for the shapes catches that on the way in, when it is still a diff and
 * not a rotation.
 */
const CREDENTIAL_SHAPES = [
  // A credential pointing at this machine is a development default, not a
  // secret — `postgres:postgres@127.0.0.1` is how PGlite and every local
  // Postgres ship. Anything pointing somewhere else is real.
  [
    /postgres(ql)?:\/\/[A-Za-z0-9_.-]+:[^@\s"'`$;{)]{3,}@(?!localhost|127\.0\.0\.1|\$|\{)/,
    "a database URL with a password in it",
  ],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "a private key"],
  [/\bsk-ant-(?!test|CANARY)[A-Za-z0-9_-]{12,}/, "an Anthropic API key"],
  [/\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./, "a signed JWT (a Supabase key looks like this)"],
  [/\bAKIA[0-9A-Z]{16}\b/, "an AWS access key id"],
];

/**
 * Files whose job is to name these shapes rather than contain one.
 *
 * Kept short and explicit. Every entry is a file that would otherwise flag
 * itself, and adding one is a visible line in a diff — which is the point,
 * because this list is also the only place a real secret could now hide.
 */
const SCANNER_FILES = [
  join("scripts", "check-db-access.mjs"),
  join("scripts", "check-bundle.mjs"),
  join("scripts", "check-production.mjs"),
  join("lib", "server", "env.ts"),
  join("lib", "server", "log.ts"),
  // Its fixtures are deliberately credential-shaped: it proves the logger
  // redacts them.
  join("lib", "server", "deployment.test.mts"),
];

/*
 * Scanned wider than the other checks. The rules above are about application
 * structure and stop at the code that ships; a pasted credential is a problem
 * wherever it lands, and a test file is exactly where one gets left behind.
 */
const credentialFiles = SEARCH_DIRS.flatMap((d) => walk(join(root, d), [], [".mts", ".mjs", ".ts", ".tsx", ".js", ".sql"]));

for (const file of credentialFiles) {
  const rel = relative(root, file);
  if (SCANNER_FILES.includes(rel)) continue;
  const source = readFileSync(file, "utf8");
  for (const [shape, what] of CREDENTIAL_SHAPES) {
    if (shape.test(source)) violations.push([rel, `contains what looks like ${what}`]);
  }
}

// --- every API route states whether it is public ---------------------------
/*
 * The failure this prevents: a new endpoint that reads room data and simply
 * never asks who is calling. Nothing about writing a route handler forces that
 * question, so this asks it — a route either consults the session or is named
 * below as deliberately open, and adding one to that list is a visible line in
 * a diff rather than an omission nobody sees.
 */
const PUBLIC_ROUTES = {
  [join("app", "api", "health", "route.ts")]:
    "a liveness probe, and it deliberately reveals nothing about the deployment",
  [join("app", "api", "judge", "route.ts")]:
    "players are never asked to sign in; defended by size caps, a per-caller limit and a ceiling on upstream spend",
  [join("app", "api", "media", "blob", "route.ts")]:
    "the signed URL is the capability, exactly as with R2; /api/media is what decides who gets one",
};

for (const file of files) {
  const rel = relative(root, file);
  if (!rel.startsWith(join("app", "api")) || !rel.endsWith(`${sep}route.ts`)) continue;
  const source = readFileSync(file, "utf8");
  const checksSession = /sessionFromRequest|currentSession|currentOrNewSession/.test(source);
  if (checksSession && PUBLIC_ROUTES[rel]) {
    violations.push([rel, "is listed as public but checks a session — remove it from PUBLIC_ROUTES"]);
  }
  if (!checksSession && !PUBLIC_ROUTES[rel]) {
    violations.push([
      rel,
      "never looks at the session. Call sessionFromRequest, or add it to PUBLIC_ROUTES\n" +
        "    in this script with the reason it is safe to leave open.",
    ]);
  }
}

// --- nothing that only exists for development may ship ---------------------
/*
 * A debug endpoint is written to be temporary and then is not. These are the
 * shapes they take — a route whose name says it, or one that dumps state — and
 * the cheapest moment to catch one is before it is deployed rather than after
 * someone finds it.
 */
const DEV_ROUTE_NAMES = /(^|[/\\])(debug|test|_test|dev|_dev|internal|admin|probe|__)[/\\]/i;

for (const file of files) {
  const rel = relative(root, file);
  if (!rel.startsWith(join("app", "api")) || !rel.endsWith(`${sep}route.ts`)) continue;
  if (DEV_ROUTE_NAMES.test(rel)) {
    violations.push([rel, "looks like a debug or test endpoint. Production has no use for one."]);
  }
  const source = readFileSync(file, "utf8");
  if (/NextResponse\.json\(\s*process\.env|JSON\.stringify\(process\.env/.test(source)) {
    violations.push([rel, "returns the process environment"]);
  }
}

// --- the ignore rules that keep secrets out of Git -------------------------
try {
  const ignored = readFileSync(join(root, ".gitignore"), "utf8");
  for (const rule of [".env.local", ".env"]) {
    if (!ignored.split("\n").some((line) => line.trim() === rule)) {
      violations.push([".gitignore", `does not ignore ${rule}`]);
    }
  }
} catch {
  violations.push([".gitignore", "missing"]);
}

if (violations.length) {
  console.log(`\n${violations.length} violation(s):\n`);
  for (const [where, why] of violations) console.log(`  ${where}\n    ${why}`);
  console.log(
    "\nThese are the structural protections that replaced row-level security. Each one\n" +
      "holds a property that review alone cannot: the database has one door, SQL takes\n" +
      "no interpolated values, secrets stay server-side, and no endpoint is open by\n" +
      "accident. Fix the cause rather than the check.\n",
  );
  process.exit(1);
}

console.log(`  ok    database access confined to lib/server/db/ (${files.length} files checked)`);
console.log("  ok    no interpolated values in SQL");
console.log("  ok    no server-only env read from a client component");
console.log("  ok    no secret-shaped NEXT_PUBLIC_ name");
console.log("  ok    no credential committed as a literal");
console.log(
  `  ok    every API route checks a session or is declared public (${Object.keys(PUBLIC_ROUTES).length} declared)`,
);
console.log("  ok    no debug, test or environment-dumping endpoints");
console.log("  ok    .gitignore keeps env files out of Git");
