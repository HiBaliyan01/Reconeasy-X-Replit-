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

const dbUrl = new URL(connectionString);
const baseHost = dbUrl.hostname;
const basePort = dbUrl.port ? Number(dbUrl.port) : 5432;
const hostOverride = process.env.SUPABASE_DB_HOST?.trim();
const portOverride = process.env.SUPABASE_DB_PORT?.trim();

const candidateHosts: Array<{ host: string; port?: number }> = [];

if (hostOverride) {
  candidateHosts.push({ host: hostOverride, port: portOverride ? Number(portOverride) : undefined });
}

candidateHosts.push({ host: baseHost, port: basePort });

if (baseHost.endsWith(".supabase.co")) {
  const projectRef = baseHost.split(".")[0];
  candidateHosts.push({ host: baseHost.replace(".supabase.co", ".supabase.net"), port: basePort });
  candidateHosts.push({ host: `${projectRef}.supabase.net`, port: basePort });
  candidateHosts.push({ host: `${projectRef}.supabase.co`, port: basePort });
  candidateHosts.push({ host: `${projectRef}.pooler.supabase.net` });
  candidateHosts.push({ host: `${projectRef}.pooler.supabase.com` });
}

const resolvedHostInfo = await (async () => {
  for (const candidate of candidateHosts) {
    if (!candidate.host) continue;
    try {
      const { address } = await dns.promises.lookup(candidate.host, { family: 4 });
      return { address, host: candidate.host, port: candidate.port };
    } catch (err) {
      continue;
    }
  }
  return null;
})();

const connectionHost = resolvedHostInfo?.address ?? hostOverride ?? baseHost;
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

export { pool };
export const db = drizzle(pool, { schema });
