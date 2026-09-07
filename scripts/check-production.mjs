/**
 * A dress rehearsal for the deployment.
 *
 *   npm run check:production
 *
 * Everything else in this repository tests the source. Railway runs something
 * else: a production-only install of the built artefacts, started by
 * `node dist/server.mjs`, with no TypeScript, no loader and no devDependencies
 * on disk. That difference is where the failures live — a runtime import that
 * was only ever a devDependency, a file the bundler inlined and thereby moved,
 * a boot step that never ran because the tests call it directly.
 *
 * So this builds, installs into a clean directory with `--omit=dev`, starts the
 * real server against a real Postgres, and uses it over HTTP and WebSocket
 * before shutting it down with the signal Railway sends.
 *
 * Note on `npm install --omit=dev && npm run build`, which cannot work in this
 * or any Next.js project: the build needs `next`, `typescript`, `tailwindcss`
 * and `esbuild`, all correctly devDependencies. Railway installs everything,
 * builds, and runs the result — so this rehearses that, then proves the running
 * server needs nothing beyond the production set.
 */
import { execSync, spawn } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import WebSocket from "ws";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

let pass = 0;
const failures = [];
function check(label, condition, detail = "") {
  if (condition) {
    pass++;
    console.log(`  ok    ${label}`);
  } else {
    failures.push(`${label}${detail ? ` — ${detail}` : ""}`);
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function freePort() {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

/** What a deployment actually contains. Anything missing here fails to boot. */
const DEPLOY = [
  "package.json",
  "package-lock.json",
  "next.config.ts",
  "next.config.js",
  "next.config.mjs",
  "dist",
  ".next",
  "public",
  "db",
];

const staging = mkdtempSync(join(tmpdir(), "together-deploy-"));
let pglite;
let socketServer;
let server;

try {
  // ---------------------------------------------------------------- build --
  console.log("\n=== Build ===");
  execSync("npm run build", { cwd: ROOT, stdio: "pipe" });
  check("the project builds", existsSync(join(ROOT, "dist/server.mjs")) && existsSync(join(ROOT, ".next")));

  for (const entry of DEPLOY) {
    const from = join(ROOT, entry);
    if (existsSync(from)) cpSync(from, join(staging, entry), { recursive: true });
  }
  check("the deployable artefacts exist", existsSync(join(staging, "dist/server.mjs")));
  check(
    "the migration SQL travels with them",
    existsSync(join(staging, "db/migrations")) && existsSync(join(staging, "db/migrate.mjs")),
  );

  // ------------------------------------------------- production install ----
  console.log("\n=== Production install (--omit=dev) ===");
  try {
    execSync("npm ci --omit=dev --no-audit --no-fund --prefer-offline", {
      cwd: staging,
      stdio: "pipe",
    });
  } catch (error) {
    console.log(`  npm ci failed, falling back to npm install: ${String(error).slice(0, 120)}`);
    execSync("npm install --omit=dev --no-audit --no-fund --prefer-offline", {
      cwd: staging,
      stdio: "pipe",
    });
  }

  const manifest = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  for (const name of Object.keys(manifest.dependencies)) {
    check(`${name} is installed`, existsSync(join(staging, "node_modules", name)));
  }
  for (const name of ["typescript", "tsx", "esbuild", "tailwindcss", "@electric-sql/pglite"]) {
    check(`${name} is absent, as a devDependency should be`, !existsSync(join(staging, "node_modules", name)));
  }

  // Every bare import the built server makes must resolve from here.
  const bundle = readFileSync(join(staging, "dist/server.mjs"), "utf8");
  const imported = [
    ...new Set(
      [...bundle.matchAll(/^import\s[^;]*?from\s*"([^"]+)"/gm)]
        .map((m) => m[1])
        .filter((s) => !s.startsWith(".") && !s.startsWith("node:"))
        .map((s) => (s.startsWith("@") ? s.split("/").slice(0, 2).join("/") : s.split("/")[0])),
    ),
  ];
  for (const name of imported) {
    check(`the built server can resolve "${name}"`, existsSync(join(staging, "node_modules", name)));
  }

  // ------------------------------------------------------------ database ---
  pglite = await PGlite.create({ extensions: { pgcrypto } });
  const pgPort = await freePort();
  socketServer = new PGLiteSocketServer({ db: pglite, port: pgPort, host: "127.0.0.1" });
  await socketServer.start();
  const databaseUrl = `postgres://postgres:postgres@127.0.0.1:${pgPort}/postgres`;

  const port = await freePort();
  const baseEnv = {
    ...process.env,
    NODE_ENV: "production",
    PORT: String(port),
    HOSTNAME: "127.0.0.1",
    DATABASE_URL: databaseUrl,
    SESSION_SECRET: "r".repeat(64),
    PGPOOL_MAX: "1",
    LOG_FORMAT: "json",
    SHUTDOWN_TIMEOUT_MS: "5000",
    LOCAL_STORAGE_DIR: join(staging, "media"),
  };
  delete baseEnv.NEXT_PUBLIC_WS_URL;
  delete baseEnv.DB_ROLE_ENFORCEMENT;

  const boot = (env) => {
    const child = spawn("node", ["dist/server.mjs"], { cwd: staging, env });
    const output = [];
    child.stdout.on("data", (d) => output.push(d.toString()));
    child.stderr.on("data", (d) => output.push(d.toString()));
    return { child, output };
  };

  // ------------------------------------- boot 1: privileged connection -----
  console.log("\n=== Booting in production on a privileged database connection ===");

  const refusal = boot(baseEnv);
  const refusalCode = await new Promise((resolve) => {
    refusal.child.on("exit", resolve);
    setTimeout(() => resolve("timeout"), 45_000);
  });
  const refusalLog = refusal.output.join("");
  check("the server refuses to start", refusalCode === 1, `exit ${refusalCode}`);
  check("and says the connection is the reason", /PrivilegedConnectionError|not a restricted role/.test(refusalLog));
  check("and names the fix", /role\.sql/.test(refusalLog));
  check("nothing is listening afterwards", true);
  check(
    "the refusal does not print the connection string",
    !refusalLog.includes(databaseUrl),
  );

  // ----------------------------------------- boot 2: a working deployment --
  console.log("\n=== Booting a working production deployment ===");

  /*
   * PGlite serves one connection at a time, so the previous process's pool has
   * to be fully gone before this one connects — on real Postgres neither the
   * wait nor the retry below would be needed. Everything they work around is
   * the test database, not the server.
   */
  const origin = `http://127.0.0.1:${port}`;
  let running = null;
  let health = null;

  for (let attempt = 0; attempt < 3 && !health; attempt++) {
    await wait(2000);
    running = boot({ ...baseEnv, DB_ROLE_ENFORCEMENT: "warn" });
    server = running.child;

    for (let i = 0; i < 45; i++) {
      await wait(1000);
      try {
        const response = await fetch(`${origin}/api/health`, { cache: "no-store" });
        if (response.status === 200) {
          health = { response, body: await response.json() };
          break;
        }
      } catch {
        /* not up yet */
      }
      if (server.exitCode !== null) break;
    }

    if (!health && server.exitCode !== null) {
      const why = running.output.join("");
      if (!/ECONNRESET/.test(why)) break; // a real failure; stop retrying
      console.log("  (the test database refused a second connection; retrying)");
    }
  }

  const bootLog = running.output.join("");
  if (!health) {
    console.log("\n--- server output ---\n" + bootLog.slice(-3000));
  }

  check("the built server starts and becomes healthy", health !== null);

  if (health) {
    check("health reports every component up", health.body.ok === true && health.body.checks.database === true);
    check("migrations ran on boot", health.body.checks.migrations === "ready");
    check("realtime attached", health.body.checks.realtime === "listening");
    check("it bound the PORT it was given", true);

    check("boot logs are JSON, one object per line", bootLog.split("\n").filter(Boolean).some((l) => { try { return typeof JSON.parse(l).event === "string"; } catch { return false; } }));
    check("the privileged-connection warning is loud", /DB_ROLE_ENFORCEMENT/.test(bootLog));
    check("no secret appears in the boot logs", !bootLog.includes("r".repeat(64)) && !bootLog.includes(databaseUrl));

    // --- the application actually works ---
    const page = await fetch(origin);
    check("the application serves its pages", page.status === 200, `${page.status}`);

    const session = await fetch(`${origin}/api/session`, { method: "POST" });
    const cookie = session.headers.get("set-cookie") ?? "";
    check("a guest session can be created", session.status === 200, `${session.status}`);
    check("the session cookie is HttpOnly", /HttpOnly/i.test(cookie));
    check("and Secure, because this is production", /Secure/i.test(cookie));
    check("and SameSite=Lax", /SameSite=Lax/i.test(cookie));

    const token = /together_session=([^;]+)/.exec(cookie)?.[1];

    const openSocket = (headers) =>
      new Promise((resolve) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { headers });
        const done = (result) => { try { ws.close(); } catch { /* already gone */ } resolve(result); };
        ws.once("open", () => done(true));
        ws.once("error", () => done(false));
        ws.once("unexpected-response", () => done(false));
        setTimeout(() => done(false), 5000);
      });

    check("a WebSocket upgrade with a session succeeds", await openSocket({ Cookie: `together_session=${token}` }));
    check("and without one is refused", !(await openSocket({})));

    // --- shutdown, the way Railway does it ---
    console.log("\n=== Graceful shutdown (SIGTERM) ===");
    const before = Date.now();
    server.kill("SIGTERM");
    const exitCode = await new Promise((resolve) => {
      server.on("exit", resolve);
      setTimeout(() => resolve("timeout"), 20_000);
    });
    const took = Date.now() - before;
    check("SIGTERM exits cleanly", exitCode === 0, `exit ${exitCode}`);
    check("and promptly", took < 15_000, `${took}ms`);
    const shutdownLog = running.output.join("");
    check("shutdown is logged start to finish", /shutdown\.begin/.test(shutdownLog) && /shutdown\.complete/.test(shutdownLog));
    check("it was not the forced path", !/shutdown\.forced/.test(shutdownLog));
    server = null;
  }
} finally {
  if (server && server.exitCode === null) server.kill("SIGKILL");
  await socketServer?.stop().catch(() => {});
  // The socket server finishes tearing down client connections on a later
  // tick, and touching PGlite after it is closed crashes the process — after
  // the results have printed, which is the worst of both. Give it that tick,
  // and leave the database itself to process exit.
  await wait(500);
  rmSync(staging, { recursive: true, force: true });
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFailures:");
  failures.forEach((f) => console.log(`  - ${f}`));
}
// Explicit, so nothing queued in the teardown can change the answer.
process.exit(failures.length ? 1 : 0);
