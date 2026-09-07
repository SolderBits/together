/**
 * The things that only go wrong on the platform.
 *
 *   npm run test:deploy
 *
 * Everything here is about the gap between "works on this laptop" and "works
 * when Railway starts it": a health check that must be willing to say no, a
 * shutdown that must finish, migrations that run twice, an application that
 * must refuse to run as the owner of its own schema, and logs that must not
 * carry the secrets they are handed.
 *
 * Same rig as the other suites — real Postgres over the wire protocol, the real
 * driver, the real route handlers.
 */
process.env.SESSION_SECRET = "x".repeat(64);
process.env.NODE_ENV = "test";
process.env.LOG_FORMAT = "json";

import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { startPgSocket } from "./testing/pg-socket.mts";
import { migrate } from "../../db/migrate.mjs";

const db = await PGlite.create({ extensions: { pgcrypto } });
const pgSocket = await startPgSocket(db);
process.env.DATABASE_URL = pgSocket.url;
process.env.PGPOOL_MAX = "1";

let pass = 0;
const failures: string[] = [];
function check(label: string, condition: boolean, detail = "") {
  if (condition) {
    pass++;
    console.log(`  ok    ${label}`);
  } else {
    failures.push(`${label}${detail ? ` — ${detail}` : ""}`);
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

// ===================================================== 1. MIGRATIONS ========

console.log("\n=== Migrations ===");

/** PGlite serves one connection at a time; let each pool fully let go. */
const settle = (ms = 250) => new Promise((r) => setTimeout(r, ms));

const first = await migrate(pgSocket.url, { quiet: true });
await settle();
check("a fresh database gets every migration", first.length >= 3, `${first.length} applied`);

const second = await migrate(pgSocket.url, { quiet: true });
await settle();
check("running them again applies nothing", second.length === 0, `${second.length} applied`);

const { query, closePool } = await import("./db/pool");

const ordered = await query<{ name: string }>(
  `select name from schema_migrations order by name`,
);
check(
  "they are recorded in lexical order, which is the order they ran",
  ordered.rows.map((r) => r.name).join() ===
    [...ordered.rows.map((r) => r.name)].sort().join(),
  ordered.rows.map((r) => r.name).join(", "),
);

const tables = await query<{ tablename: string }>(
  `select tablename from pg_tables where schemaname = 'public' order by tablename`,
);
const present = tables.rows.map((r) => r.tablename);
for (const expected of ["media", "room_members", "room_players", "rooms", "sessions"]) {
  check(`table ${expected} exists`, present.includes(expected));
}

// The indexes that keep the hot paths off sequential scans, and the constraints
// that stop bad rows existing at all.
const indexes = await query<{ indexname: string }>(
  `select indexname from pg_indexes where schemaname = 'public'`,
);
const indexNames = indexes.rows.map((r) => r.indexname).join(" ");
for (const [what, needle] of [
  ["rooms are looked up by code", "rooms_code"],
  ["expired rooms are found without a scan", "rooms_expiry_idx"],
  ["presence is read per room", "room_players_room_idx"],
  ["stale presence is found by last_seen", "room_players_last_seen_idx"],
  ["sessions expire on an index", "sessions_expires"],
  ["media is listed per room", "media_room"],
  ["abandoned uploads are found on a partial index", "media_pending_idx"],
] as const) {
  check(`${what} (${needle})`, indexNames.includes(needle), indexNames);
}

const constraints = await query<{ conname: string; contype: string }>(
  `select conname, contype from pg_constraint
    where connamespace = 'public'::regnamespace`,
);
const byType = (t: string) => constraints.rows.filter((r) => r.contype === t).length;
check("primary keys exist on every table", byType("p") >= 5, `${byType("p")} found`);
check("foreign keys tie the rows together", byType("f") >= 4, `${byType("f")} found`);
check("check constraints guard the enumerations", byType("c") >= 2, `${byType("c")} found`);

const roomCode = await query<{ n: string }>(
  `select count(*) as n from pg_constraint
    where conrelid = 'rooms'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%code%'`,
);
check("the room code shape is enforced by the database, not only by code", Number(roomCode.rows[0].n) > 0);

// A cascade means deleting a room takes its members, presence and media with
// it. Without it, pruning leaves orphans that nothing will ever collect.
const cascades = await query<{ n: string }>(
  `select count(*) as n from pg_constraint
    where contype = 'f' and confdeltype = 'c'
      and confrelid = 'rooms'::regclass`,
);
check("deleting a room cascades to its children", Number(cascades.rows[0].n) >= 3, `${cascades.rows[0].n}`);

// ==================================================== 2. DATABASE ROLE ======

console.log("\n=== The connection the application runs as ===");

const { inspectDatabaseRole, assertRestrictedRole, PrivilegedConnectionError } = await import(
  "./db/role-check"
);

const report = await inspectDatabaseRole();
check("the role check can read the connection's privileges", typeof report.role === "string" && report.role.length > 0, report.role);
check(
  "this test database is (correctly) unrestricted — it is the owner",
  !report.restricted,
  JSON.stringify(report.reasons),
);
check("and it says exactly why", report.reasons.length > 0, report.reasons.join("; "));

let refused = false;
try {
  await assertRestrictedRole({ production: true });
} catch (error) {
  refused = error instanceof PrivilegedConnectionError;
}
check("in production, booting on an owner connection is refused", refused);

let allowedOutsideProduction = true;
try {
  await assertRestrictedRole({ production: false });
} catch {
  allowedOutsideProduction = false;
}
check("outside production it warns instead of stopping local work", allowedOutsideProduction);

const message = new PrivilegedConnectionError(report).message;
check("the refusal names the fix", /db\/role\.sql/.test(message) && /MIGRATE_DATABASE_URL/.test(message));
check("and leaks no connection string", !/postgres:\/\//.test(message));

console.log("\n=== db/role.sql actually restricts ===");

/*
 * The file has never been executed by anything — it is run once by hand against
 * Railway and then trusted forever. So run it here, adapted only where it must
 * be (PGlite ignores the user in a connection string, so the role is reached
 * with SET ROLE rather than by connecting as it), and check that the role it
 * creates can do its job and nothing else.
 */
const roleSql = (await import("node:fs")).readFileSync(
  new URL("../../db/role.sql", import.meta.url),
  "utf8",
);

const statements = roleSql
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n")
  .split(";")
  .map((x) => x.trim())
  .filter(Boolean)
  .map((x) => x.replace("'REPLACE_ME'", "'rehearsal-only'"));

check("role.sql is a series of statements, not a document", statements.length >= 6, `${statements.length}`);

for (const statement of statements) {
  await query(statement);
}
check("every statement in role.sql runs against a real schema", true);

const grants = await query<{ table_name: string; privilege_type: string }>(
  `select table_name, privilege_type from information_schema.role_table_grants
    where grantee = 'together_app' order by table_name, privilege_type`,
);
const granted = new Set(grants.rows.map((r) => r.table_name));
check(
  "the role reaches exactly the five application tables",
  [...granted].sort().join() === "media,room_members,room_players,rooms,sessions",
  [...granted].sort().join(", "),
);
check(
  "with exactly the four verbs",
  new Set(grants.rows.map((r) => r.privilege_type)).size === 4,
  [...new Set(grants.rows.map((r) => r.privilege_type))].join(", "),
);

// Now act as it, and try the things it must not be able to do.
const attempt = async (label: string, sql: string) => {
  try {
    await query(`set role together_app`);
    await query(sql);
    await query(`reset role`);
    return { allowed: true, label };
  } catch {
    await query(`reset role`).catch(() => {});
    return { allowed: false, label };
  }
};

for (const [what, sql] of [
  ["create a table", "create table sneaky (id int)"],
  ["drop a table", "drop table media"],
  ["alter a table", "alter table rooms add column backdoor text"],
  ["read the migration ledger", "select * from schema_migrations"],
  ["read other roles", "select * from pg_authid"],
] as const) {
  const result = await attempt(what, sql);
  check(`the application role cannot ${what}`, !result.allowed);
}

const canWork = await attempt("read rooms", "select count(*) from rooms");
check("but it can do its actual job", canWork.allowed);

await query(`reset role`).catch(() => {});

// ========================================================= 3. HEALTH ========

console.log("\n=== Health and readiness ===");

const { setRuntimeStatus, resetRuntimeStatus, runtimeStatus } = await import("./runtime-status");
const healthRoute = await import("../../app/api/health/route");

const readHealth = async () => {
  const response = await healthRoute.GET();
  return { response, body: (await response.json()) as Record<string, unknown> };
};

resetRuntimeStatus();
{
  // Nothing has reported in yet: migrations pending, realtime not attached.
  const { response, body } = await readHealth();
  check("a process that has not finished starting is not healthy", response.status === 503, `${response.status}`);
  check("and says which part is not ready", (body.checks as Record<string, unknown>)?.migrations === "pending");
}

setRuntimeStatus({ migrations: "ready" });
{
  const { response, body } = await readHealth();
  check(
    "migrations done but realtime not attached is still not healthy",
    response.status === 503 && (body.checks as Record<string, unknown>)?.realtime === "off",
    `${response.status}`,
  );
}

setRuntimeStatus({ realtime: "listening" });
{
  const { response, body } = await readHealth();
  check("with the database up, migrations done and realtime attached, it is healthy", response.status === 200 && body.ok === true, `${response.status}`);
  check("and reports every component", Object.keys((body.checks ?? {}) as object).sort().join() === "database,migrations,realtime");
}

setRuntimeStatus({ realtime: "stopping" });
{
  const { response } = await readHealth();
  check("a draining instance stops reporting healthy", response.status === 503);
}
setRuntimeStatus({ realtime: "listening" });

setRuntimeStatus({ migrations: "failed" });
{
  const { response } = await readHealth();
  check("a failed migration is never healthy", response.status === 503);
}
setRuntimeStatus({ migrations: "ready" });

{
  // The database itself going away is the case the old check got wrong.
  await closePool();
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = "postgres://nobody:nobody@127.0.0.1:1/nothing";
  const { response, body } = await readHealth();
  check(
    "an unreachable database is reported as unhealthy",
    response.status === 503 && (body.checks as Record<string, unknown>)?.database === false,
    `${response.status}`,
  );
  process.env.DATABASE_URL = previous;
  await closePool();
  // PGlite serves one connection at a time; the refused pool needs a moment to
  // let go before a fresh one can bind.
  await settle();
}

{
  const { response } = await readHealth();
  check("and it recovers when the database comes back", response.status === 200, `${response.status}`);
}

{
  const { response } = await readHealth();
  const cacheControl = response.headers.get("cache-control") ?? "";
  check("health is uncacheable", /no-store/.test(cacheControl) && /no-cache/.test(cacheControl), cacheControl);
  check("including by a CDN that honours its own header", response.headers.get("cdn-cache-control") === "no-store");
}

{
  const { body } = await readHealth();
  const text = JSON.stringify(body);
  check("health describes nothing about the deployment", !/postgres|127\.0\.0\.1|railway|version|role|together_app/i.test(text), text);
}

check("uptime is reported", typeof (await readHealth()).body.uptimeSeconds === "number");
check("the status is shared across module instances", runtimeStatus().realtime === "listening");

// =========================================================== 4. LOGS ========

console.log("\n=== Logs must not carry secrets ===");

const { log, redactForTest } = await import("./log");

const SECRETS = {
  sessionToken: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhYmMxMjMifQ.c2lnbmF0dXJlaGVyZQ",
  dbUrl: "postgres://together_app:hunter2ProdPassword@db.railway.internal:5432/railway",
  apiKey: "sk-ant-api03-REALLOOKINGKEY0000000000",
  r2Secret: "R2SecretAccessKey0123456789abcdef",
  signedUrl: "https://bucket.r2.cloudflarestorage.com/rooms/r/m.jpg?X-Amz-Signature=abc123def456&X-Amz-Expires=900",
  localSignedUrl: "/api/media/blob?key=rooms/r/m.jpg&expires=1799999999&sig=Zm9vYmFyc2lnbmF0dXJl",
  cookie: "together_session=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.sig; Path=/; HttpOnly",
  plainPassword: "PlainValueWithNoRecognisableShape123",
};

// Everything is thrown at the logger the way it would really arrive: under
// obvious names, under innocent names, nested, inside errors, inside causes.
const captured: string[] = [];
const realLog = console.log;
const realError = console.error;
console.log = (...a: unknown[]) => captured.push(a.join(" "));
console.error = (...a: unknown[]) => captured.push(a.join(" "));

log.info("test.obvious-names", {
  sessionToken: SECRETS.sessionToken,
  DATABASE_URL: SECRETS.dbUrl,
  apiKey: SECRETS.apiKey,
  cookie: SECRETS.cookie,
  // Shapeless: nothing about these values gives them away, so only the field
  // name can save them. Without this the key rule is never actually exercised.
  r2Secret: SECRETS.r2Secret,
  password: SECRETS.plainPassword,
  secretAccessKey: SECRETS.plainPassword,
});
log.info("test.innocent-names", {
  where: SECRETS.dbUrl,
  photo: SECRETS.signedUrl,
  link: SECRETS.localSignedUrl,
  note: `connecting with ${SECRETS.apiKey}`,
});
log.error("test.inside-an-error", {
  error: Object.assign(new Error(`upload to ${SECRETS.signedUrl} failed`), {
    cause: new Error(`while connected to ${SECRETS.dbUrl}`),
  }),
});
log.warn("test.nested", { a: { b: { c: { request: { headers: { cookie: SECRETS.cookie } } } } } });
log.info("test.array", { attempts: [SECRETS.signedUrl, SECRETS.localSignedUrl] });

console.log = realLog;
console.error = realError;

const logged = captured.join("\n");
for (const [name, secret] of Object.entries(SECRETS)) {
  check(`${name} never reaches the log`, !logged.includes(secret));
}
// The distinctive middles, in case a prefix survived a partial redaction.
for (const [name, fragment] of [
  ["the database password", "hunter2ProdPassword"],
  ["the R2 signature", "abc123def456"],
  ["the local signature", "Zm9vYmFyc2lnbmF0dXJl"],
  ["the API key body", "REALLOOKINGKEY"],
] as const) {
  check(`${name} does not survive in fragments`, !logged.includes(fragment), fragment);
}

check("but the event names are still there to search on", logged.includes("test.inside-an-error"));
check("and an error keeps its message shape", /failed/.test(logged));
check("and its stack, which is safe to log", /deployment\.test/.test(logged));
check("output is one JSON object per line", captured.every((l) => { try { JSON.parse(l); return true; } catch { return false; } }));

// The scrubber on its own, including the shapes that have no field name.
check("a circular object does not hang the logger", JSON.stringify(redactForTest((() => { const o: Record<string, unknown> = {}; o.self = o; return o; })())).includes("circular"));
/*
 * The field names that must be redacted, and the ones that must not. Both
 * halves matter: a rule that redacts everything is safe and useless, and
 * `sessionId`, `roomCode` and `playerId` are exactly what makes a production
 * log worth reading.
 */
const shapeless = "PlainValueWithNoRecognisableShape123";
const mustRedact = ["r2Secret", "apiKey", "accessKeyId", "secretAccessKey", "SESSION_SECRET", "sessionToken", "cookie", "DATABASE_URL", "password", "sig", "signature", "authorization", "serviceRoleKey", "objectKey"];
const mustKeep = ["monkey", "keyboard", "sessionId", "roomCode", "author", "playerId", "mode", "storage", "bytes", "reasons"];
const scrubbed = redactForTest(
  Object.fromEntries([...mustRedact, ...mustKeep].map((k) => [k, shapeless])),
) as Record<string, string>;
check(
  `every secret-shaped field name is redacted (${mustRedact.length})`,
  mustRedact.every((k) => scrubbed[k] === "[redacted]"),
  mustRedact.filter((k) => scrubbed[k] !== "[redacted]").join(", "),
);
check(
  `and ordinary field names survive, or the logs are useless (${mustKeep.length})`,
  mustKeep.every((k) => scrubbed[k] === shapeless),
  mustKeep.filter((k) => scrubbed[k] !== shapeless).join(", "),
);

check("a private key block is removed", !JSON.stringify(redactForTest({ note: "-----BEGIN RSA PRIVATE KEY-----\nabc\n-----END RSA PRIVATE KEY-----" })).includes("abc"));

// ==================================================== 5. POOL SIZING ========

console.log("\n=== Connection pool ===");

const poolSource = await import("node:fs").then((fs) =>
  fs.readFileSync(new URL("./db/pool.ts", import.meta.url), "utf8"),
);
check("the pool size is configurable rather than hard-coded", /PGPOOL_MAX/.test(poolSource));
check("it closes idle connections", /idleTimeoutMillis/.test(poolSource));
check("it gives up rather than hanging on connect", /connectionTimeoutMillis/.test(poolSource));

// --- teardown ---------------------------------------------------------------

await closePool();
await pgSocket.server.stop();
await db.close();

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFailures:");
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
process.exit(0);
