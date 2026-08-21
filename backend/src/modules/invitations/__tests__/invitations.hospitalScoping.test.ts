import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = {
  role: { findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
  invitation: { findFirst: vi.fn(), create: vi.fn() },
  department: { findUnique: vi.fn() },
};

vi.mock("../../../config/prisma", () => ({ prisma: mockPrisma }));
vi.mock("../../../utils/mailer", () => ({ mailer: { sendInvitationEmail: vi.fn() } }));
vi.mock("../../../utils/audit", () => ({ writeAudit: vi.fn() }));

const { createInvitation } = await import("../invitations.service");

describe("createInvitation hospital scoping — regression guard", () => {
  beforeEach(() => {
    mockPrisma.role.findUnique.mockReset().mockResolvedValue({ id: "role-doctor", code: "DOCTOR", name: "Doctor" });
    mockPrisma.user.findUnique.mockReset().mockResolvedValue(null);
    mockPrisma.invitation.findFirst.mockReset().mockResolvedValue(null);
    mockPrisma.invitation.create.mockReset().mockImplementation(({ data }: any) => Promise.resolve({ ...data, id: "inv-1" }));
    mockPrisma.department.findUnique.mockReset();
  });

  it("ADMIN's invitation is forced to their own hospital, even if they submit a different one", async () => {
    const actor = { id: "admin-1", roleCode: "ADMIN", hospitalId: "hospital-A" };

    await createInvitation(actor, { email: "doc@example.com", roleCode: "DOCTOR", hospitalId: "hospital-B" });

    const createCall = mockPrisma.invitation.create.mock.calls[0][0];
    expect(createCall.data.hospitalId).toBe("hospital-A"); // never "hospital-B"
  });

  it("ADMIN with no hospital assigned is rejected outright rather than creating an unscoped invite", async () => {
    const actor = { id: "admin-1", roleCode: "ADMIN", hospitalId: null };

    await expect(
      createInvitation(actor, { email: "doc@example.com", roleCode: "DOCTOR" })
    ).rejects.toMatchObject({ code: "NO_HOSPITAL_ASSIGNED" });

    expect(mockPrisma.invitation.create).not.toHaveBeenCalled();
  });

  it("SUPER_ADMIN's explicit hospitalId is honored (they can target any hospital)", async () => {
    const actor = { id: "sa-1", roleCode: "SUPER_ADMIN", hospitalId: null };

    await createInvitation(actor, { email: "doc@example.com", roleCode: "DOCTOR", hospitalId: "hospital-B" });

    const createCall = mockPrisma.invitation.create.mock.calls[0][0];
    expect(createCall.data.hospitalId).toBe("hospital-B");
  });

  it("rejects a department that belongs to a DIFFERENT hospital than the invitation is scoped to", async () => {
    mockPrisma.department.findUnique.mockResolvedValue({ id: "dept-1", hospitalId: "hospital-OTHER" });
    const actor = { id: "admin-1", roleCode: "ADMIN", hospitalId: "hospital-A" };

    await expect(
      createInvitation(actor, { email: "doc@example.com", roleCode: "DOCTOR", departmentId: "dept-1" })
    ).rejects.toThrow(/does not belong/i);

    expect(mockPrisma.invitation.create).not.toHaveBeenCalled();
  });

  it("accepts a department that DOES belong to the resolved hospital", async () => {
    mockPrisma.department.findUnique.mockResolvedValue({ id: "dept-1", hospitalId: "hospital-A" });
    const actor = { id: "admin-1", roleCode: "ADMIN", hospitalId: "hospital-A" };

    await expect(
      createInvitation(actor, { email: "doc@example.com", roleCode: "DOCTOR", departmentId: "dept-1" })
    ).resolves.toBeDefined();
  });

  it("rejects a role that isn't onboardable via invitation (e.g. ADMIN or PATIENT)", async () => {
    const actor = { id: "sa-1", roleCode: "SUPER_ADMIN", hospitalId: null };

    await expect(createInvitation(actor, { email: "x@example.com", roleCode: "ADMIN" })).rejects.toThrow();
    expect(mockPrisma.invitation.create).not.toHaveBeenCalled();
  });
});