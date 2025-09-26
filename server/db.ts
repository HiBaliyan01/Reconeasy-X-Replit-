import dns from "dns";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

pg.defaults.ssl = pg.defaults.ssl ?? {
  rejectUnauthorized: false,
};

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const dbUrl = new URL(connectionString);
let effectiveConnectionString = connectionString;

try {
  const { address } = await dns.promises.lookup(dbUrl.hostname, {
    family: 4,
    hints: dns.ADDRCONFIG,
  });

  dbUrl.hostname = address;
  dbUrl.host = `${address}${dbUrl.port ? `:${dbUrl.port}` : ""}`;
  effectiveConnectionString = dbUrl.toString();
} catch (resolutionError) {
  console.warn(
    `Failed to resolve IPv4 address for ${dbUrl.hostname}. Falling back to default DNS resolution.`,
    resolutionError,
  );
}

const pool = new Pool({
  connectionString: effectiveConnectionString,
  ssl: {
    rejectUnauthorized: false,
  },
});

export { pool };
export const db = drizzle(pool, { schema });
