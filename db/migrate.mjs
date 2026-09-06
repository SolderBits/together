/**
 * Forward-only migration runner.
 *
 *   node db/migrate.mjs
 *
 * Runs on boot, before the server accepts traffic. Two things make that safe
 * when Railway starts more than one instance at once: an advisory lock, so only
 * one process migrates and the others wait rather than racing, and a record of
 * what has already run, so the winner's work is not repeated.
 *
 * Every file is also written to be idempotent on its own (`if not exists`), so
 * a re-run is harmless even if the ledger is ever lost.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(here, "migrations");

/** Arbitrary but constant: two runners must pick the same lock id. */
const LOCK_ID = 776_2110;

export async function migrate(connectionString = process.env.DATABASE_URL, { quiet = false } = {}) {
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — nothing to migrate against.");
  }

  const log = quiet ? () => {} : (...a) => console.log(...a);
  const pool = new pg.Pool({
    connectionString,
    // Railway's Postgres presents a certificate its own proxy signs; verifying
    // it needs their CA, which is not worth a bundled root store here. The
    // connection is still encrypted.
    ssl: /localhost|127\.0\.0\.1/.test(connectionString) ? false : { rejectUnauthorized: false },
    max: 2,
  });

  const client = await pool.connect();
  const applied = [];

  try {
    await client.query(`
      create table if not exists schema_migrations (
        name       text primary key,
        applied_at timestamptz not null default now()
      );
    `);

    // Blocks until whoever else is migrating has finished.
    await client.query("select pg_advisory_lock($1)", [LOCK_ID]);

    try {
      const done = new Set(
        (await client.query("select name from schema_migrations")).rows.map((r) => r.name),
      );

      const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort();

      for (const name of files) {
        if (done.has(name)) continue;

        const sql = readFileSync(join(MIGRATIONS, name), "utf8");
        // Each migration is its own transaction: a failure leaves the database
        // on the last good one rather than half-way through this one.
        await client.query("begin");
        try {
          await client.query(sql);
          await client.query("insert into schema_migrations (name) values ($1)", [name]);
          await client.query("commit");
          applied.push(name);
          log(`  applied  ${name}`);
        } catch (error) {
          await client.query("rollback");
          throw new Error(`Migration ${name} failed: ${error.message}`);
        }
      }

      if (!applied.length) log("  up to date");
    } finally {
      await client.query("select pg_advisory_unlock($1)", [LOCK_ID]);
    }
  } finally {
    client.release();
    await pool.end();
  }

  return applied;
}

// Only when run directly, not when imported by the server on boot.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  migrate()
    .then((applied) => {
      console.log(applied.length ? `\n${applied.length} migration(s) applied.` : "\nNothing to do.");
      process.exit(0);
    })
    .catch((error) => {
      console.error(`\n${error.message}`);
      process.exit(1);
    });
}
