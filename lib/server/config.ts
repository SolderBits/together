import "server-only";

/**
 * Server configuration questions that are not database access.
 *
 * `databaseConfigured()` used to live next to the pool, which meant every route
 * that merely wanted to know whether Railway is configured had to import the
 * module that can talk to Postgres. The access guard was right to object: the
 * point of confining the pool is that nothing outside the data layer holds a
 * reference to it, and "it only wanted the boolean" is exactly the kind of
 * exception that erodes a structural rule.
 *
 * This reads environment variables and nothing else.
 */

/** Railway Postgres is configured, so the hosted backend is available. */
export function databaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/** Object storage is configured, so media can be uploaded. */
export function objectStorageConfigured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET,
  );
}

/** The whole Railway backend is usable: a database and a signing secret. */
export function railwayBackendConfigured(): boolean {
  return databaseConfigured() && Boolean(process.env.SESSION_SECRET);
}
