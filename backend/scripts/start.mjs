// Production entrypoint: builds DATABASE_URL from parts (as injected by ECS/Secrets Manager),
// applies pending migrations, then starts the API.
import { spawnSync } from "node:child_process";

if (!process.env.DATABASE_URL && process.env.DB_HOST) {
  const user = encodeURIComponent(process.env.DB_USER ?? "tailskart");
  const pass = encodeURIComponent(process.env.DB_PASSWORD ?? "");
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT ?? "5432";
  const name = process.env.DB_NAME ?? "tailskart";
  const ssl = process.env.DB_SSLMODE ?? "require";
  process.env.DATABASE_URL = `postgresql://${user}:${pass}@${host}:${port}/${name}?schema=public&sslmode=${ssl}&connection_limit=${process.env.DB_POOL_SIZE ?? 10}`;
}

if (process.env.RUN_MIGRATIONS !== "false") {
  console.log("Applying database migrations…");
  const r = spawnSync("npx", ["prisma", "migrate", "deploy"], { stdio: "inherit", shell: process.platform === "win32", env: process.env });
  if (r.status !== 0) {
    console.error("Migration failed — refusing to start.");
    process.exit(r.status ?? 1);
  }
}

if (process.env.RUN_SEED === "true") {
  console.log("Seeding database…");
  const s = spawnSync("node", ["--import", "tsx", "prisma/seed.ts"], { stdio: "inherit", shell: process.platform === "win32", env: process.env });
  if (s.status !== 0) {
    console.warn("Seeding warning or failure, continuing startup…");
  }
}

await import("../dist/index.js");
