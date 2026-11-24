// Runs a local PostgreSQL server without Docker (development only).
// Usage: npm run db:local   (leave it running in its own terminal)
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import EmbeddedPostgres from "embedded-postgres";

const dataDir = resolve(process.cwd(), ".pgdata");
const port = Number(process.env.LOCAL_PG_PORT ?? 5433);

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "tailskart",
  password: "tailskart",
  port,
  persistent: true,
  // Force UTF-8 regardless of the OS locale (Windows defaults to WIN1252).
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
});

const fresh = !existsSync(resolve(dataDir, "PG_VERSION"));
if (fresh) {
  console.log("Initialising local Postgres data directory…");
  await pg.initialise();
}
await pg.start();

const client = pg.getPgClient();
await client.connect();
for (const db of ["tailskart", "tailskart_test"]) {
  const r = await client.query("SELECT pg_encoding_to_char(encoding) AS enc FROM pg_database WHERE datname = $1", [db]);
  if (r.rows[0] && r.rows[0].enc !== "UTF8") {
    console.log(`Recreating ${db} with UTF8 encoding (was ${r.rows[0].enc})`);
    await client.query(`DROP DATABASE "${db}" WITH (FORCE)`);
  }
  if (!r.rows[0] || r.rows[0].enc !== "UTF8") {
    await client.query(`CREATE DATABASE "${db}" ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0`);
    console.log(`Created database ${db}`);
  }
}
await client.end();

console.log(`\nPostgres ready on port ${port}`);
console.log(`DATABASE_URL=postgresql://tailskart:tailskart@localhost:${port}/tailskart?schema=public\n`);
console.log("Press Ctrl+C to stop.");

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
