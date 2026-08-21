import { app } from "./app";
import { env, isEmailConfigured, mailProvider } from "./config/env";
import { logger } from "./config/logger";
import { prisma } from "./config/prisma";

const server = app.listen(env.PORT, () => {
  logger.info(`HMS API listening on port ${env.PORT} [${env.NODE_ENV}]`);
  // Unmissable at every boot — so a stale/misconfigured mailer never has to
  // be diagnosed by triggering a request and reading warning logs after.
  if (!isEmailConfigured) {
    logger.info("Email: NOT configured — no SMTP_* or RESEND_API_KEY set. Emails will be logged only, not sent.");
  } else if (mailProvider === "smtp") {
    logger.info(`Email: SMTP configured (host: ${env.SMTP_HOST}, from: ${env.SMTP_FROM_EMAIL ?? env.SMTP_USER})`);
  } else {
    logger.info(`Email: Resend configured (sender: ${env.RESEND_SENDER_EMAIL})`);
  }
});

async function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down gracefully`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled promise rejection");
});