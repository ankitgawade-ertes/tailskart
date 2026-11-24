import { execSync } from "node:child_process";

/** Resets the test database schema before the suite runs. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://tailskart:tailskart@localhost:5433/tailskart_test?schema=public";
  execSync("npx prisma migrate reset --force --skip-seed --skip-generate", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url, PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "yes" },
  });
}
