/**
 * Runs before every test file. config/env.ts validates process.env with zod
 * at MODULE LOAD TIME and calls process.exit(1) if required vars are
 * missing — so these must be set before anything imports env.ts (directly
 * or transitively via config/prisma.ts, etc.), not inside individual tests.
 * These are dummy values; nothing here talks to a real database or sends
 * real email — every test in this suite mocks the Prisma client.
 */
process.env.NODE_ENV = "test";
process.env.CLIENT_URL = "http://localhost:5173";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/hms_test";
process.env.JWT_ACCESS_SECRET = "test_access_secret_at_least_32_characters_long";
process.env.JWT_REFRESH_SECRET = "test_refresh_secret_at_least_32_characters_long";