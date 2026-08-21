import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = {
  appointment: { findMany: vi.fn(), count: vi.fn() },
  patientProfile: { findUnique: vi.fn() },
  doctorProfile: { findUnique: vi.fn() },
};

vi.mock("../../../config/prisma", () => ({ prisma: mockPrisma }));

const { listAppointments } = await import("../appointments.service");

const baseFilters = { page: 1, pageSize: 20 };

describe("listAppointments hospitalId filter — SUPER_ADMIN-only regression guard", () => {
  beforeEach(() => {
    mockPrisma.appointment.findMany.mockReset().mockResolvedValue([]);
    mockPrisma.appointment.count.mockReset().mockResolvedValue(0);
    mockPrisma.patientProfile.findUnique.mockReset();
    mockPrisma.doctorProfile.findUnique.mockReset();
  });

  it("SUPER_ADMIN with no hospitalId filter sees every hospital (no hospitalId in the where clause)", async () => {
    const actor = { id: "sa-1", roleCode: "SUPER_ADMIN", hospitalId: null };

    await listAppointments(actor, baseFilters);

    const where = mockPrisma.appointment.findMany.mock.calls[0][0].where;
    expect(where.hospitalId).toBeUndefined();
  });

  it("SUPER_ADMIN's explicit hospitalId filter is honored", async () => {
    const actor = { id: "sa-1", roleCode: "SUPER_ADMIN", hospitalId: null };

    await listAppointments(actor, { ...baseFilters, hospitalId: "hospital-B" });

    const where = mockPrisma.appointment.findMany.mock.calls[0][0].where;
    expect(where.hospitalId).toBe("hospital-B");
  });

  it("ADMIN stays forced to their OWN hospital even if a hospitalId filter is somehow sent", async () => {
    const actor = { id: "admin-1", roleCode: "ADMIN", hospitalId: "hospital-A" };

    await listAppointments(actor, { ...baseFilters, hospitalId: "hospital-B" });

    const where = mockPrisma.appointment.findMany.mock.calls[0][0].where;
    expect(where.hospitalId).toBe("hospital-A"); // never "hospital-B"
  });

  it("DOCTOR's own-doctor scoping is unaffected — hospitalId filter is ignored, not merged in", async () => {
    mockPrisma.doctorProfile.findUnique.mockResolvedValue({ id: "doc-profile-1" });
    const actor = { id: "doc-1", roleCode: "DOCTOR", hospitalId: "hospital-A" };

    await listAppointments(actor, { ...baseFilters, hospitalId: "hospital-B" });

    const where = mockPrisma.appointment.findMany.mock.calls[0][0].where;
    expect(where.doctorId).toBe("doc-profile-1");
    expect(where.hospitalId).toBeUndefined();
  });

  it("PATIENT's own-patient scoping is unaffected — hospitalId filter is ignored, not merged in", async () => {
    mockPrisma.patientProfile.findUnique.mockResolvedValue({ id: "patient-profile-1" });
    const actor = { id: "patient-1", roleCode: "PATIENT", hospitalId: null };

    await listAppointments(actor, { ...baseFilters, hospitalId: "hospital-B" });

    const where = mockPrisma.appointment.findMany.mock.calls[0][0].where;
    expect(where.patientId).toBe("patient-profile-1");
    expect(where.hospitalId).toBeUndefined();
  });
});
