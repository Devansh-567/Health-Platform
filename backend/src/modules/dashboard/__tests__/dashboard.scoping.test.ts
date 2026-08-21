import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = {
  hospital: { count: vi.fn() },
  role: { findMany: vi.fn() },
  invitation: { count: vi.fn() },
  appointment: { count: vi.fn(), findMany: vi.fn() },
  auditLog: { count: vi.fn(), findMany: vi.fn() },
  user: { count: vi.fn() },
  doctorProfile: { findUnique: vi.fn() },
  nurseProfile: { findUnique: vi.fn() },
  patientProfile: { findUnique: vi.fn() },
  doctorPatientMap: { count: vi.fn() },
  nursePatientMap: { count: vi.fn(), findMany: vi.fn() },
  diagnosis: { count: vi.fn() },
  vitalSign: { count: vi.fn() },
  prescription: { count: vi.fn() },
  report: { findMany: vi.fn() },
};

vi.mock("../../../config/prisma", () => ({ prisma: mockPrisma }));

const { getOverview } = await import("../dashboard.service");

function resetAll() {
  Object.values(mockPrisma).forEach((model) => Object.values(model).forEach((fn) => (fn as any).mockReset()));
  mockPrisma.hospital.count.mockResolvedValue(0);
  mockPrisma.role.findMany.mockResolvedValue([]);
  mockPrisma.invitation.count.mockResolvedValue(0);
  mockPrisma.appointment.count.mockResolvedValue(0);
  mockPrisma.appointment.findMany.mockResolvedValue([]);
  mockPrisma.auditLog.count.mockResolvedValue(0);
  mockPrisma.auditLog.findMany.mockResolvedValue([]);
  mockPrisma.user.count.mockResolvedValue(0);
  mockPrisma.doctorPatientMap.count.mockResolvedValue(0);
  mockPrisma.nursePatientMap.count.mockResolvedValue(0);
  mockPrisma.nursePatientMap.findMany.mockResolvedValue([]);
  mockPrisma.diagnosis.count.mockResolvedValue(0);
  mockPrisma.vitalSign.count.mockResolvedValue(0);
  mockPrisma.prescription.count.mockResolvedValue(0);
  mockPrisma.report.findMany.mockResolvedValue([]);
}

describe("dashboard overview — actor-derived scoping regression guard", () => {
  beforeEach(resetAll);

  it("ADMIN's queries are always filtered to their OWN hospitalId (never client-influenced, since there is no input)", async () => {
    const actor = { id: "admin-1", roleCode: "ADMIN", hospitalId: "hospital-A" };

    await getOverview(actor);

    for (const call of mockPrisma.user.count.mock.calls) {
      expect(call[0].where.hospitalId).toBe("hospital-A");
    }
    const upcomingCall = mockPrisma.appointment.findMany.mock.calls.find((c) => c[0].where.hospitalId);
    expect(upcomingCall?.[0].where.hospitalId).toBe("hospital-A");
  });

  it("ADMIN with no linked hospital gets a safe empty overview, not a crash or cross-tenant data", async () => {
    const actor = { id: "admin-1", roleCode: "ADMIN", hospitalId: null };

    const result: any = await getOverview(actor);

    expect(result.hospitalId).toBeNull();
    expect(result.staff).toEqual({ doctors: 0, nurses: 0 });
    expect(mockPrisma.user.count).not.toHaveBeenCalled();
  });

  it("DOCTOR overview is scoped to their OWN doctorProfile id, derived from the JWT actor id", async () => {
    mockPrisma.doctorProfile.findUnique.mockResolvedValue({ id: "doc-profile-1" });
    const actor = { id: "doc-user-1", roleCode: "DOCTOR", hospitalId: "hospital-A" };

    await getOverview(actor);

    expect(mockPrisma.doctorProfile.findUnique).toHaveBeenCalledWith({ where: { userId: "doc-user-1" } });
    expect(mockPrisma.doctorPatientMap.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ doctorId: "doc-profile-1" }) })
    );
  });

  it("NURSE overview is scoped to their OWN nurseProfile id", async () => {
    mockPrisma.nurseProfile.findUnique.mockResolvedValue({ id: "nurse-profile-1" });
    const actor = { id: "nurse-user-1", roleCode: "NURSE", hospitalId: "hospital-A" };

    await getOverview(actor);

    expect(mockPrisma.nursePatientMap.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ nurseId: "nurse-profile-1" }) })
    );
    expect(mockPrisma.vitalSign.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ recordedById: "nurse-user-1" }) })
    );
  });

  it("PATIENT overview is scoped to their OWN patientProfile id — never another patient's", async () => {
    mockPrisma.patientProfile.findUnique.mockResolvedValue({
      id: "patient-profile-1",
      dateOfBirth: null,
      gender: null,
      bloodGroup: null,
      address: null,
      emergencyContact: null,
      emergencyPhone: null,
    });
    const actor = { id: "patient-user-1", roleCode: "PATIENT", hospitalId: null };

    const result: any = await getOverview(actor);

    expect(mockPrisma.prescription.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ patientId: "patient-profile-1" }) })
    );
    expect(result.profileCompleteness.percent).toBe(0);
    expect(result.profileCompleteness.missingFields).toHaveLength(6);
  });

  it("SUPER_ADMIN gets a system-wide overview with no hospital/staff scoping applied", async () => {
    const actor = { id: "sa-1", roleCode: "SUPER_ADMIN", hospitalId: null };

    const result: any = await getOverview(actor);

    expect(result.roleCode).toBe("SUPER_ADMIN");
    expect(mockPrisma.doctorProfile.findUnique).not.toHaveBeenCalled();
  });
});
