import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger, prisma } from "./lib/core.js";
import { sweepAbandonedPayments } from "./lib/orders.js";

const app = createApp();
const server = app.listen(env.PORT, () => logger.info(`Tailskart API listening on :${env.PORT} (${env.NODE_ENV})`));
server.keepAliveTimeout = 65_000; // longer than the ALB idle timeout (60s)
server.headersTimeout = 66_000;

const sweeper = setInterval(() => {
  sweepAbandonedPayments().catch((err) => logger.error({ err }, "Abandoned-payment sweep failed"));
}, 5 * 60_000);

async function shutdown(signal: string) {
  logger.info(`${signal} received — shutting down`);
  clearInterval(sweeper);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 25_000).unref();
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("unhandledRejection", (err) => logger.error({ err }, "Unhandled promise rejection"));
