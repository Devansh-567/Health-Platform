/**
 * Dev/test utility — deletes a single user by email so you can re-test
 * signup/invite flows without hitting "email already exists".
 *
 * Usage:
 *   npm run db:delete-user -- someone@example.com
 *
 * NOT for production use. If the user has sent invitations or created other
 * users, deletion will fail with a foreign-key error (by design — that's
 * data integrity working correctly) and you'll need to handle those
 * relations first.
 */
import { prisma } from "../src/config/prisma";
import { normalizeEmail } from "../src/utils/normalizeEmail";

async function main() {
  const rawEmail = process.argv[2];
  if (!rawEmail) {
    console.error("Usage: npm run db:delete-user -- someone@example.com");
    process.exit(1);
  }

  const email = normalizeEmail(rawEmail);
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    console.log(`No user found with email "${email}" — nothing to delete.`);
    return;
  }

  try {
    await prisma.user.delete({ where: { id: user.id } });
    console.log(`Deleted user "${email}" (id: ${user.id}, role: ${user.roleId}).`);
  } catch (err: any) {
    console.error(
      `Could not delete "${email}" — it likely has related records (invitations sent, users it created, etc.) blocking deletion.\n` +
        `Details: ${err.message}`
    );
    process.exit(1);
  }
}

main().finally(() => prisma.$disconnect());