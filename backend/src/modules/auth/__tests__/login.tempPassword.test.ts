import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = {
  user: { findUnique: vi.fn(), update: vi.fn() },
};

vi.mock("../../../config/prisma", () => ({ prisma: mockPrisma }));
vi.mock("../../../utils/hash", () => ({ verifyPassword: vi.fn().mockResolvedValue(true) }));
vi.mock("../../../utils/mailer", () => ({ mailer: { sendAccountLockedEmail: vi.fn() } }));
vi.mock("../../../utils/audit", () => ({ writeAudit: vi.fn() }));
vi.mock("../token.service", () => ({
  issueTokenPair: vi.fn().mockResolvedValue({ accessToken: "a", refreshToken: "r", refreshExpiresAt: new Date() }),
}));

const { login } = await import("../auth.service");

const baseUser = {
  id: "user-1",
  email: "pat@example.com",
  passwordHash: "hashed",
  status: "ACTIVE",
  isEmailVerified: true,
  lockedUntil: null,
  failedLoginCount: 0,
  firstName: "P",
  lastName: "Q",
  hospitalId: "hospital-A",
  role: { code: "PATIENT" },
};

const fakeReq = { ip: "127.0.0.1", headers: {} } as any;

describe("login — temp password expiry", () => {
  beforeEach(() => {
    mockPrisma.user.findUnique.mockReset();
    mockPrisma.user.update.mockReset().mockResolvedValue({});
  });

  it("rejects login when mustChangePassword is true and the temp password window has passed", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...baseUser,
      mustChangePassword: true,
      tempPasswordExpiresAt: new Date(Date.now() - 60 * 60 * 1000), // 1h in the past
    });

    await expect(login(baseUser.email, "whatever", fakeReq)).rejects.toMatchObject({
      code: "TEMP_PASSWORD_EXPIRED",
    });
  });

  it("allows login when mustChangePassword is true but the temp password hasn't expired yet", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...baseUser,
      mustChangePassword: true,
      tempPasswordExpiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1h in the future
    });

    const result = await login(baseUser.email, "whatever", fakeReq);
    expect(result.user.mustChangePassword).toBe(true);
  });

  it("allows login for a normal account with no temp password state at all", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...baseUser,
      mustChangePassword: false,
      tempPasswordExpiresAt: null,
    });

    const result = await login(baseUser.email, "whatever", fakeReq);
    expect(result.user.mustChangePassword).toBe(false);
  });
});
