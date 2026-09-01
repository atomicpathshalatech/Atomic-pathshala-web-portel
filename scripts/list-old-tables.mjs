import pg from "pg";
import fs from "fs";

function getEnvVar(name) {
  for (const file of [".env.local", ".env"]) {
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, "utf8");
    const line = text.split(/\r?\n/).find((l) => l.startsWith(name + "="));
    if (line) return line.slice(name.length + 1).trim().replace(/^"|"$/g, "");
  }
  return process.env[name] ?? null;
}

const url = getEnvVar("OLD_SUPABASE_DATABASE_URL");
if (!url) { console.error("OLD_SUPABASE_DATABASE_URL not set"); process.exit(1); }

const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();
const r = await c.query(
  "SELECT table_schema, table_name FROM information_schema.tables WHERE table_type='BASE TABLE' AND table_schema NOT IN ('pg_catalog','information_schema') ORDER BY table_schema, table_name"
);
console.log(r.rows.map((x) => `${x.table_schema}.${x.table_name}`).join("\n"));
await c.end();
