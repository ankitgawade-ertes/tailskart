import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globalSetup: ["./tests/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgresql://tailskart:tailskart@localhost:5433/tailskart_test?schema=public",
      JWT_SECRET: "test-customer-secret-test-customer-secret-123",
      ADMIN_JWT_SECRET: "test-admin-secret-test-admin-secret-test-1234",
      OTP_PROVIDER: "test",
      PAYMENT_PROVIDER: "mock",
      STORAGE_DRIVER: "local",
      CORS_ORIGINS: "http://localhost:3000,http://localhost:5173",
    },
  },
});
