import "server-only";
import { query } from "./pool";

/**
 * Refuses to run the application on the connection that owns the schema.
 *
 * The authorization model is application code now, and application code has
 * bugs. `db/role.sql` creates `together_app` so that a query escaping the gates
 * in `lib/server/db/` is a bug rather than a breach — it can read and write five
 * tables and do nothing else.
 *
 * None of which happens if the operator points `DATABASE_URL` at the superuser
 * Railway hands them and moves on. That is the easy path, it works perfectly,
 * and nothing about it looks wrong. So this checks, on boot, and in production
 * it stops the deploy: a restricted role that is never actually used is not a
 * security control, it is a file.
 *
 * Outside production it warns instead, because a local PGlite database has one
 * role and setting up a second to run the tests would be theatre.
 */

export interface RoleReport {
  role: string;
  superuser: boolean;
  bypassRls: boolean;
  ownsTables: boolean;
  canCreate: boolean;
  restricted: boolean;
  reasons: string[];
}

export async function inspectDatabaseRole(): Promise<RoleReport> {
  const { rows } = await query<{
    role: string;
    superuser: boolean;
    bypass_rls: boolean;
    can_create: boolean;
    owned: string | null;
  }>(
    `select
       current_user                                as role,
       coalesce(r.rolsuper, false)                 as superuser,
       coalesce(r.rolbypassrls, false)             as bypass_rls,
       coalesce(has_schema_privilege(current_user, 'public', 'CREATE'), false) as can_create,
       (select string_agg(t.tablename, ', ')
          from pg_tables t
         where t.schemaname = 'public'
           and t.tableowner = current_user)        as owned
     from pg_roles r
     where r.rolname = current_user`,
  );

  const row = rows[0] ?? {
    role: "unknown",
    superuser: false,
    bypass_rls: false,
    can_create: false,
    owned: null,
  };

  const reasons: string[] = [];
  if (row.superuser) reasons.push("it is a superuser");
  if (row.bypass_rls) reasons.push("it bypasses row-level security");
  if (row.can_create) reasons.push("it can create objects in the public schema");
  if (row.owned) reasons.push(`it owns tables (${row.owned})`);

  return {
    role: row.role,
    superuser: row.superuser,
    bypassRls: row.bypass_rls,
    ownsTables: Boolean(row.owned),
    canCreate: row.can_create,
    restricted: reasons.length === 0,
    reasons,
  };
}

export class PrivilegedConnectionError extends Error {
  constructor(report: RoleReport) {
    super(
      `The application is connected to Postgres as "${report.role}", which is not a ` +
        `restricted role: ${report.reasons.join("; ")}.\n\n` +
        "Run db/role.sql once as the owner, then set DATABASE_URL to the together_app\n" +
        "role and MIGRATE_DATABASE_URL to the owner. The owner connection is for\n" +
        "migrations only and must never be what serves traffic.",
    );
    this.name = "PrivilegedConnectionError";
  }
}

/**
 * Throws in production if the connection is privileged; warns otherwise.
 * Returns what it found either way, so the caller can log it.
 *
 * `DB_ROLE_ENFORCEMENT=warn` downgrades the throw to the warning. It exists for
 * one purpose: rehearsing a production boot against a local database that has
 * only one role — PGlite ignores the user in the connection string, so there is
 * no restricted connection to offer it. Every boot that uses it says so in the
 * logs, and `validateEnvironment` flags it as a warning of its own. It is not a
 * setting for a real deployment, and scripts/check-production.mjs proves the
 * strict path still refuses by booting once without it.
 */
export async function assertRestrictedRole(
  {
    production = process.env.NODE_ENV === "production",
    enforcement = process.env.DB_ROLE_ENFORCEMENT ?? "strict",
  } = {},
): Promise<RoleReport> {
  const report = await inspectDatabaseRole();
  const strict = production && enforcement !== "warn";
  if (!report.restricted && strict) throw new PrivilegedConnectionError(report);
  return report;
}
