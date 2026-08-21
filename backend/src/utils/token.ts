import crypto from "crypto";

/** Generates a URL-safe opaque token to send to the client (email link, cookie). */
export const generateOpaqueToken = () => crypto.randomBytes(32).toString("base64url");

/** One-way hash of an opaque token for DB storage — raw tokens are never persisted. */
export const hashOpaqueToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

const LOWER = "abcdefghjkmnpqrstuvwxyz"; // excludes i, l, o — avoids visual ambiguity in an emailed password
const UPPER = "ABCDEFGHJKMNPQRSTUVWXYZ";
const DIGITS = "23456789"; // excludes 0, 1
const SYMBOLS = "!@#$%^&*-_+=";
const ALL = LOWER + UPPER + DIGITS + SYMBOLS;

function randomChar(charset: string): string {
  return charset[crypto.randomInt(charset.length)];
}

/**
 * Generates a random temporary password that satisfies the app's password
 * policy (>=10 chars, upper, lower, digit, symbol) by construction, so it
 * never needs a retry loop. Used for admin-issued accounts (e.g. patient
 * invitations) where the person never chooses their own password — they
 * receive this one by email and must change it on first login.
 */
export function generateTempPassword(length = 12): string {
  const required = [randomChar(LOWER), randomChar(UPPER), randomChar(DIGITS), randomChar(SYMBOLS)];
  const rest = Array.from({ length: Math.max(length, required.length) - required.length }, () => randomChar(ALL));

  const chars = [...required, ...rest];
  // Fisher-Yates shuffle so the required characters aren't always in the same positions.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
