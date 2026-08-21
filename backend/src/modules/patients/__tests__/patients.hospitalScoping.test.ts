import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = {
  role: { findUnique: vi.fn() },
  user: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  department: { findUnique: vi.fn() },
  refreshToken: { updateMany: vi.fn() },
};

vi.mock("../../../config/prisma", () => ({ prisma: mockPrisma }));
vi.mock("../../../utils/mailer", () => ({ mailer: { sendPatientTempPasswordEmail: vi.fn() } }));
vi.mock("../../../utils/audit", () => ({ writeAudit: vi.fn() }));
vi.mock("../../../utils/hash", () => ({ hashPassword: vi.fn().mockResolvedValue("hashed") }));
vi.mock("../../auth/token.service", () => ({ revokeAllUserSessions: vi.fn() }));

const { createPatient, resendPatientCredentials } = await import("../patients.service");

describe("createPatient hospital scoping — regression guard", () => {
  beforeEach(() => {
    mockPrisma.role.findUnique.mockReset().mockResolvedValue({ id: "role-patient", code: "PATIENT", name: "Patient" });
    mockPrisma.user.findUnique.mockReset().mockResolvedValue(null);
    mockPrisma.user.create.mockReset().mockImplementation(({ data }: any) => Promise.resolve({ ...data, id: "user-1" }));
    mockPrisma.department.findUnique.mockReset();
  });

  it("ADMIN's patient is forced into their own hospital, even if they submit a different one", async () => {
    const actor = { id: "admin-1", roleCode: "ADMIN", hospitalId: "hospital-A" };

    await createPatient(actor, { email: "pat@example.com", firstName: "P", lastName: "Q", hospitalId: "hospital-B" });

    const createCall = mockPrisma.user.create.mock.calls[0][0];
    expect(createCall.data.hospitalId).toBe("hospital-A"); // never "hospital-B"
  });

  it("ADMIN with no hospital assigned is rejected outright rather than creating an unscoped patient", async () => {
    const actor = { id: "admin-1", roleCode: "ADMIN", hospitalId: null };

    await expect(
      createPatient(actor, { email: "pat@example.com", firstName: "P", lastName: "Q" })
    ).rejects.toMatchObject({ code: "NO_HOSPITAL_ASSIGNED" });

    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  it("SUPER_ADMIN's explicit hospitalId is honored (they can target any hospital)", async () => {
    const actor = { id: "sa-1", roleCode: "SUPER_ADMIN", hospitalId: null };

    await createPatient(actor, { email: "pat@example.com", firstName: "P", lastName: "Q", hospitalId: "hospital-B" });

    const createCall = mockPrisma.user.create.mock.calls[0][0];
    expect(createCall.data.hospitalId).toBe("hospital-B");
  });

  it("rejects an email that already belongs to an existing user", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: "existing" });
    const actor = { id: "admin-1", roleCode: "ADMIN", hospitalId: "hospital-A" };

    await expect(
      createPatient(actor, { email: "pat@example.com", firstName: "P", lastName: "Q" })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("rejects a department that belongs to a DIFFERENT hospital than the patient is scoped to", async () => {
    mockPrisma.department.findUnique.mockResolvedValue({ id: "dept-1", hospitalId: "hospital-OTHER" });
    const actor = { id: "admin-1", roleCode: "ADMIN", hospitalId: "hospital-A" };

    await expect(
      createPatient(actor, { email: "pat@example.com", firstName: "P", lastName: "Q", departmentId: "dept-1" })
    ).rejects.toThrow(/does not belong/i);
  });

  it("issues a mustChangePassword=true account with a temp password that is never returned in the API response", async () => {
    const actor = { id: "admin-1", roleCode: "ADMIN", hospitalId: "hospital-A" };

    const result = await createPatient(actor, { email: "pat@example.com", firstName: "P", lastName: "Q" });

    const createCall = mockPrisma.user.create.mock.calls[0][0];
    expect(createCall.data.mustChangePassword).toBe(true);
    expect(createCall.data.status).toBe("ACTIVE");
    expect(createCall.data.tempPasswordExpiresAt).toBeInstanceOf(Date);
    expect(result).not.toHaveProperty("temporaryPassword");
    expect(result).not.toHaveProperty("password");
  });
});

describe("resendPatientCredentials hospital scoping — regression guard", () => {
  beforeEach(() => {
    mockPrisma.user.findFirst.mockReset();
    mockPrisma.user.update.mockReset().mockResolvedValue({});
  });

  it("ADMIN cannot resend credentials for a patient in a different hospital", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      id: "pat-1",
      hospitalId: "hospital-B",
      status: "ACTIVE",
      email: "pat@example.com",
      role: { code: "PATIENT" },
    });
    const actor = { id: "admin-1", roleCode: "ADMIN", hospitalId: "hospital-A" };

    await expect(resendPatientCredentials(actor, "pat-1")).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("404s for a user that isn't a PATIENT (can't be used to reset a doctor's password)", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      id: "doc-1",
      hospitalId: "hospital-A",
      status: "ACTIVE",
      email: "doc@example.com",
      role: { code: "DOCTOR" },
    });
    const actor = { id: "admin-1", roleCode: "ADMIN", hospitalId: "hospital-A" };

    await expect(resendPatientCredentials(actor, "doc-1")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
