import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  CLIENT_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().default(7),
  PASSWORD_RESET_TTL_MIN: z.coerce.number().default(30),
  INVITATION_TTL_DAYS: z.coerce.number().default(3),
  // How long an admin-issued patient temporary password stays valid. The
  // person's spec asked for "1-2 days" — 48h default sits at the top of
  // that range so patients in a different timezone from their hospital
  // still get a full working day either side.
  PATIENT_TEMP_PASSWORD_TTL_HOURS: z.coerce.number().min(1).max(72).default(48),
  MAX_FAILED_LOGIN_ATTEMPTS: z.coerce.number().default(5),
  ACCOUNT_LOCK_MINUTES: z.coerce.number().default(15),

  // Mail provider selection. Left unset, the app auto-detects: SMTP creds
  // present -> "smtp"; else RESEND_API_KEY present -> "resend"; else
  // "console" (log-only, never sends — email must never be a hard
  // dependency for the API to boot or for login to work).
  MAIL_PROVIDER: z.enum(["smtp", "resend", "console"]).optional(),

  // Generic SMTP — works with a real mailbox/relay (Gmail + app password,
  // your own domain's mail server, Mailtrap/SES/SendGrid/Zoho SMTP, etc.).
  // Unlike Resend's free sandbox sender, a real SMTP account can send to
  // ANY recipient, not just the address the API key/account was created
  // with — this is the fix for "I can only email myself".
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  // "true" for implicit TLS (usually port 465); leave "false"/unset for
  // STARTTLS on 587 or plaintext on 25 — nodemailer negotiates STARTTLS
  // automatically when the server offers it.
  SMTP_SECURE: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  // Defaults to SMTP_USER if not set — most SMTP relays require the From
  // address to match (or be authorized for) the authenticated account.
  SMTP_FROM_EMAIL: z.string().email().optional(),
  SMTP_FROM_NAME: z.string().default("HMS"),

  // Resend (https://resend.com) — free tier, no domain verification required
  // when sending from the default onboarding@resend.dev address, BUT that
  // setup can only deliver to the email address you signed up to Resend
  // with. Verify a domain on Resend (or switch to SMTP above) to send to
  // arbitrary recipients.
  RESEND_API_KEY: z.string().optional(),
  RESEND_SENDER_EMAIL: z.string().email().default("onboarding@resend.dev"),
  RESEND_SENDER_NAME: z.string().default("HMS"),

  // HiveMQ Cloud (or any MQTT broker) — used ONLY for publishing the
  // hospital emergency-alarm event server-side (utils/mqtt.ts). The
  // frontend connects to the SAME broker directly over MQTT-over-WebSocket
  // for everything else (live PPG vitals, subscribing to alarms) — see
  // frontend .env.example for its matching VITE_MQTT_* vars. Optional: if
  // unset, alarms simply aren't published and a warning is logged, the same
  // "never a hard dependency" pattern as the mailer.
  MQTT_URL: z.string().optional(), // e.g. mqtts://<cluster-id>.s1.eu.hivemq.cloud:8883
  MQTT_USERNAME: z.string().optional(),
  MQTT_PASSWORD: z.string().optional(),

  // Cloudflare R2 (or any S3-compatible bucket) — used for uploaded clinical
  // report files (config/storage.ts). Optional: if unset, the app falls
  // back to local disk under backend/uploads/reports, which is fine for
  // local dev but is NOT guaranteed to survive a redeploy on most free
  // hosts. Create a free R2 bucket at https://dash.cloudflare.com -> R2,
  // then R2 -> Manage API Tokens for the key pair. Endpoint is always
  // https://<account_id>.r2.cloudflarestorage.com — no separate URL to copy.
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),

  COOKIE_DOMAIN: z.string().default("localhost"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";

/**
 * Auto-detected unless MAIL_PROVIDER is set explicitly. SMTP takes priority
 * over Resend when both are configured, since a real mailbox/relay is what
 * lets the app send to arbitrary recipients rather than just the Resend
 * account owner.
 */
function resolveMailProvider(): "smtp" | "resend" | "console" {
  if (env.MAIL_PROVIDER) return env.MAIL_PROVIDER;
  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD) return "smtp";
  if (env.RESEND_API_KEY) return "resend";
  return "console";
}

export const mailProvider = resolveMailProvider();
export const isEmailConfigured = mailProvider !== "console";
export const isMqttConfigured = !!(env.MQTT_URL && env.MQTT_USERNAME && env.MQTT_PASSWORD);
export const isR2Configured = !!(env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET_NAME);