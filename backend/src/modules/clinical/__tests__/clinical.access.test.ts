import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiError } from "../../../utils/ApiError";

const mockPrisma = {
  user: { findFirst: vi.fn() },
  doctorProfile: { findUnique: vi.fn() },
  nurseProfile: { findUnique: vi.fn() },
  doctorPatientMap: { findUnique: vi.fn() },
  nursePatientMap: { findUnique: vi.fn() },
  diagnosis: { findMany: vi.fn() },
};

vi.mock("../../../config/prisma", () => ({ prisma: mockPrisma }));
vi.mock("../../../utils/audit", () => ({ writeAudit: vi.fn() }));

const { listDiagnoses } = await import("../clinical.service");

const PATIENT_PROFILE_ID = "patient-profile-1";
const patientUser = {
  role: { code: "PATIENT" },
  patientProfile: { id: PATIENT_PROFILE_ID },
};

describe("clinical records access model — listDiagnoses", () => {
  beforeEach(() => {
    Object.values(mockPrisma).forEach((model) => Object.values(model).forEach((fn) => (fn as any).mockReset()));
    mockPrisma.user.findFirst.mockResolvedValue(patientUser);
    mockPrisma.diagnosis.findMany.mockResolvedValue([]);
  });

  it("SUPER_ADMIN can list without any assignment check", async () => {
    const actor = { id: "sa-1", roleCode: "SUPER_ADMIN", hospitalId: null };

    await listDiagnoses(actor, "patient-user-1");

    expect(mockPrisma.doctorPatientMap.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.nursePatientMap.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.diagnosis.findMany).toHaveBeenCalledTimes(1);
  });

  it("ADMIN is filtered to their OWN hospital regardless of anything else", async () => {
    const actor = { id: "admin-1", roleCode: "ADMIN", hospitalId: "hospital-A" };

    await listDiagnoses(actor, "patient-user-1");

    const call = mockPrisma.diagnosis.findMany.mock.calls[0][0];
    expect(call.where.hospitalId).toBe("hospital-A");
  });

  it("ADMIN with no hospital assigned gets no hospital filter applied (falls through, not a crash)", async () => {
    const actor = { id: "admin-1", roleCode: "ADMIN", hospitalId: null };

    await listDiagnoses(actor, "patient-user-1");

    const call = mockPrisma.diagnosis.findMany.mock.calls[0][0];
    expect(call.where.hospitalId).toBeUndefined();
  });

  it("DOCTOR with an ACTIVE assignment is allowed", async () => {
    mockPrisma.doctorProfile.findUnique.mockResolvedValue({ id: "doc-profile-1" });
    mockPrisma.doctorPatientMap.findUnique.mockResolvedValue({ isActive: true });
    const actor = { id: "doc-1", roleCode: "DOCTOR", hospitalId: "hospital-A" };

    await expect(listDiagnoses(actor, "patient-user-1")).resolves.toEqual([]);
  });

  it("DOCTOR with NO assignment record at all is forbidden", async () => {
    mockPrisma.doctorProfile.findUnique.mockResolvedValue({ id: "doc-profile-1" });
    mockPrisma.doctorPatientMap.findUnique.mockResolvedValue(null);
    const actor = { id: "doc-1", roleCode: "DOCTOR", hospitalId: "hospital-A" };

    await expect(listDiagnoses(actor, "patient-user-1")).rejects.toThrow(ApiError);
    await expect(listDiagnoses(actor, "patient-user-1")).rejects.toMatchObject({ statusCode: 403 });
  });

  it("DOCTOR with an INACTIVE (unassigned) mapping is forbidden — not just a missing row", async () => {
    mockPrisma.doctorProfile.findUnique.mockResolvedValue({ id: "doc-profile-1" });
    mockPrisma.doctorPatientMap.findUnique.mockResolvedValue({ isActive: false });
    const actor = { id: "doc-1", roleCode: "DOCTOR", hospitalId: "hospital-A" };

    await expect(listDiagnoses(actor, "patient-user-1")).rejects.toMatchObject({ statusCode: 403 });
  });

  it("NURSE checks the nurse assignment map, not the doctor one", async () => {
    mockPrisma.nurseProfile.findUnique.mockResolvedValue({ id: "nurse-profile-1" });
    mockPrisma.nursePatientMap.findUnique.mockResolvedValue({ isActive: true });
    const actor = { id: "nurse-1", roleCode: "NURSE", hospitalId: "hospital-A" };

    await listDiagnoses(actor, "patient-user-1");

    expect(mockPrisma.nursePatientMap.findUnique).toHaveBeenCalledTimes(1);
    expect(mockPrisma.doctorPatientMap.findUnique).not.toHaveBeenCalled();
  });

  it("PATIENT role is always forbidden on the staff-facing route — regression test: a", async () => {
    // patient must go through the separate /me/* endpoints (listMyDiagnoses),
    // which resolve their OWN profile directly. This function has no
    // PATIENT branch at all and must reject, not silently allow or crash —
    // a real bug in this exact spot shipped once already.
    const actor = { id: "patient-1", roleCode: "PATIENT", hospitalId: null };

    await expect(listDiagnoses(actor, "some-other-patient-user-id")).rejects.toMatchObject({ statusCode: 403 });
  });

  it("throws 404 when the target user is not an active patient", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const actor = { id: "sa-1", roleCode: "SUPER_ADMIN", hospitalId: null };

    await expect(listDiagnoses(actor, "not-a-patient")).rejects.toMatchObject({ statusCode: 404 });
  });
});