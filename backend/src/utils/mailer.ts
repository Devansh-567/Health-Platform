import nodemailer from "nodemailer";
import { env, isEmailConfigured, mailProvider } from "../config/env";
import { logger } from "../config/logger";

const RESEND_URL = "https://api.resend.com/emails";

// Built lazily (only once SMTP is actually the active provider) and cached —
// creating a fresh transporter per email would mean a fresh TCP/TLS
// handshake every time.
let smtpTransporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getSmtpTransporter() {
  if (!smtpTransporter) {
    smtpTransporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    });
  }
  return smtpTransporter;
}

async function sendViaSmtp(to: string, subject: string, html: string) {
  const fromAddress = env.SMTP_FROM_EMAIL ?? env.SMTP_USER;
  await getSmtpTransporter().sendMail({
    from: `"${env.SMTP_FROM_NAME}" <${fromAddress}>`,
    to,
    subject,
    html,
  });
}

async function sendViaResend(to: string, subject: string, html: string) {
  const res = await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: `${env.RESEND_SENDER_NAME} <${env.RESEND_SENDER_EMAIL}>`,
      to: [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    // The #1 cause on Resend's free tier (sending from onboarding@resend.dev
    // without a verified domain) is that you can only send to the email
    // address you signed up to Resend with — sending to any other address
    // gets rejected with a 403 here.
    throw new Error(
      `Resend rejected the send (HTTP ${res.status}): ${body}. ` +
        `If you're on Resend's free tier without a verified domain, it can only deliver to the ` +
        `address you signed up with — verify a domain at resend.com/domains, or set MAIL_PROVIDER=smtp ` +
        `(with SMTP_HOST/SMTP_USER/SMTP_PASSWORD) to send from a real mailbox instead.`
    );
  }
}

async function send(to: string, subject: string, html: string) {
  if (!isEmailConfigured) {
    logger.warn({ to, subject }, "Email not sent — no mail provider configured (see SMTP_* / RESEND_API_KEY in .env)");
    return;
  }

  try {
    if (mailProvider === "smtp") {
      await sendViaSmtp(to, subject, html);
    } else {
      await sendViaResend(to, subject, html);
    }
    logger.info({ to, subject, mailProvider }, "Email sent");
  } catch (err) {
    // Loud, unmissable console output — a silently-swallowed email is one
    // of the hardest bugs to notice from the outside.
    // eslint-disable-next-line no-console
    console.error(`\n[MAILER] Failed to send via ${mailProvider}\n[MAILER] to=${to} subject="${subject}"\n`, err);
    logger.error({ err, to, subject, mailProvider }, "Failed to send email");
  }
}

export const mailer = {
  sendVerificationEmail: (to: string, link: string) =>
    send(to, "Verify your HMS account", `<p>Click to verify your account:</p><a href="${link}">${link}</a>`),

  sendPasswordResetEmail: (to: string, link: string) =>
    send(to, "Reset your HMS password", `<p>Reset your password (expires soon):</p><a href="${link}">${link}</a>`),

  sendInvitationEmail: (to: string, link: string, roleName: string) =>
    send(
      to,
      `You're invited to join HMS as ${roleName}`,
      `<p>You have been invited as ${roleName}. Accept your invite:</p><a href="${link}">${link}</a>`
    ),

  // Patients are onboarded directly by an admin rather than via a self-service
  // "accept invite" link — the account already exists, so we send its login
  // credentials and a hard expiry. mustChangePassword is set server-side,
  // forcing the patient to set their own password on first login.
  sendPatientTempPasswordEmail: (to: string, temporaryPassword: string, loginUrl: string, expiresAt: Date) =>
    send(
      to,
      "Your HMS patient account has been created",
      `<p>An account has been created for you on HMS.</p>
       <p><strong>Email:</strong> ${to}<br/>
          <strong>Temporary password:</strong> ${temporaryPassword}</p>
       <p>Sign in within <strong>${formatExpiry(expiresAt)}</strong> at <a href="${loginUrl}">${loginUrl}</a> and you'll be asked to set your own password.</p>
       <p>If this link expires before you sign in, ask hospital staff to resend your invite.</p>`
    ),

  sendAccountLockedEmail: (to: string) =>
    send(to, "HMS account locked", "<p>Your account was locked due to multiple failed login attempts.</p>"),
};

function formatExpiry(expiresAt: Date): string {
  const hours = Math.max(1, Math.round((expiresAt.getTime() - Date.now()) / (60 * 60 * 1000)));
  if (hours % 24 === 0) {
    const days = hours / 24;
    return `${days} day${days === 1 ? "" : "s"}`;
  }
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}
