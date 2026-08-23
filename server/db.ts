import dns from "dns";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

if (typeof dns.setDefaultResultOrder === "function") {
  try {
    dns.setDefaultResultOrder("ipv4first");
  } catch (err) {
    console.warn("Failed to force IPv4 DNS priority", err);
  }
}

let dbUrl: URL;
try {
  dbUrl = new URL(connectionString);
} catch {
  throw new Error(
    `DATABASE_URL is not a valid URL. Received: ${connectionString}. ` +
      "Expected a full Postgres connection string, e.g. postgres://user:pass@host:5432/dbname"
  );
}
const baseHost = dbUrl.hostname;
const basePort = dbUrl.port ? Number(dbUrl.port) : 5432;
const hostOverrideRaw = process.env.SUPABASE_DB_HOST?.trim();
const hostOverrides = hostOverrideRaw ? hostOverrideRaw.split(",").map((host) => host.trim()).filter(Boolean) : [];
const portOverride = process.env.SUPABASE_DB_PORT?.trim();
const primaryHostOverride = hostOverrides[0];
const configuredSupabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const configuredSupabaseHost = configuredSupabaseUrl ? new URL(configuredSupabaseUrl).hostname : undefined;

const candidateHosts: Array<{ host: string; port?: number }> = [];

if (hostOverrides.length) {
  const overridePort = portOverride ? Number(portOverride) : undefined;
  for (const host of hostOverrides) {
    candidateHosts.push({ host, port: overridePort });
  }
}

candidateHosts.push({ host: primaryHostOverride ?? baseHost, port: portOverride ? Number(portOverride) : basePort });

if (baseHost.endsWith(".supabase.co")) {
  const projectRef = baseHost.split(".")[0];
  candidateHosts.push({ host: baseHost.replace(".supabase.co", ".supabase.net"), port: basePort });
  candidateHosts.push({ host: `${projectRef}.supabase.net`, port: basePort });
  candidateHosts.push({ host: `${projectRef}.supabase.co`, port: basePort });
  candidateHosts.push({ host: `${projectRef}.pooler.supabase.net` });
  candidateHosts.push({ host: `${projectRef}.pooler.supabase.com` });
}

if (configuredSupabaseHost) {
  dns.promises.lookup(configuredSupabaseHost).catch(() => {
    console.warn(
      `[db] Configured Supabase URL host "${configuredSupabaseHost}" does not resolve. ` +
        "Check VITE_SUPABASE_URL/SUPABASE_URL and DATABASE_URL project ref.",
    );
  });
}

const resolvedHostInfo = candidateHosts.find((candidate) => Boolean(candidate.host));

const connectionHost = resolvedHostInfo?.host ?? primaryHostOverride ?? baseHost;
const connectionPort = resolvedHostInfo?.port ?? (portOverride ? Number(portOverride) : basePort);

if (!connectionHost) {
  throw new Error("Unable to resolve a database host. Set SUPABASE_DB_HOST with an IPv4 address.");
}

if (!Number.isFinite(connectionPort)) {
  throw new Error("Invalid database port configuration.");
}

console.info(`[db] Attempting Supabase connection via host ${connectionHost}`);

const poolConfig: pg.PoolConfig = {
  host: connectionHost,
  port: connectionPort,
  database: dbUrl.pathname.replace(/^\//, "") || undefined,
  user: dbUrl.username ? decodeURIComponent(dbUrl.username) : undefined,
  password: dbUrl.password ? decodeURIComponent(dbUrl.password) : undefined,
  ssl: { rejectUnauthorized: false },
};

const connectTimeout = dbUrl.searchParams.get("connect_timeout") ?? dbUrl.searchParams.get("connection_timeout");
if (connectTimeout) {
  const timeoutSeconds = Number(connectTimeout);
  if (!Number.isNaN(timeoutSeconds) && timeoutSeconds > 0) {
    poolConfig.connectionTimeoutMillis = timeoutSeconds * 1000;
  }
}

const maxConnections = dbUrl.searchParams.get("max");
if (maxConnections) {
  const max = Number(maxConnections);
  if (!Number.isNaN(max) && max > 0) {
    poolConfig.max = max;
  }
}

const keepAlive = dbUrl.searchParams.get("keepalive");
if (keepAlive) {
  poolConfig.keepAlive = keepAlive !== "0";
}

const pool = new Pool(poolConfig);
pool.on("connect", () => {
  console.info("[db] Connected to Supabase via connection pooler");
});

pool.on("error", (err) => {
  console.error("[db] Unexpected database pool error:", err);
});

export const describeDatabaseError = (err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes("(ENOTFOUND) tenant/user")) {
    return (
      "Supabase pooler could not find this tenant/user. Verify that DATABASE_URL uses the " +
      "pooler host copied from the active Supabase project's Dashboard > Connect panel, and " +
      "that the project ref in VITE_SUPABASE_URL matches the username suffix in DATABASE_URL."
    );
  }
  return undefined;
};

export { pool };
export const db = drizzle(pool, { schema });
