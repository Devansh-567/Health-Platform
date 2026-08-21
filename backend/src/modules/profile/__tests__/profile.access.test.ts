import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiError } from "../../../utils/ApiError";

const mockPrisma = {
  patientProfile: { findUnique: vi.fn(), update: vi.fn() },
};

vi.mock("../../../config/prisma", () => ({ prisma: mockPrisma }));
vi.mock("../../../utils/audit", () => ({ writeAudit: vi.fn() }));

const { getMyProfile, updateMyProfile } = await import("../profile.service");

describe("getMyProfile", () => {
  beforeEach(() => {
    mockPrisma.patientProfile.findUnique.mockReset();
  });

  it("PATIENT gets their own profile, looked up by their OWN userId from the JWT actor", async () => {
    mockPrisma.patientProfile.findUnique.mockResolvedValue({ id: "profile-1", userId: "patient-1" });
    const actor = { id: "patient-1", roleCode: "PATIENT", hospitalId: null };

    const result = await getMyProfile(actor);

    expect(mockPrisma.patientProfile.findUnique).toHaveBeenCalledWith({ where: { userId: "patient-1" } });
    expect(result.roleCode).toBe("PATIENT");
    expect(result.editableFields.length).toBeGreaterThan(0);
    expect(result.profile).toEqual({ id: "profile-1", userId: "patient-1" });
  });

  it("non-PATIENT roles (e.g. DOCTOR) get an empty profile with no editable fields, without querying patientProfile at all", async () => {
    const actor = { id: "doc-1", roleCode: "DOCTOR", hospitalId: "hospital-A" };

    const result = await getMyProfile(actor);

    expect(mockPrisma.patientProfile.findUnique).not.toHaveBeenCalled();
    expect(result).toEqual({ roleCode: "DOCTOR", editableFields: [], profile: null });
  });
});

describe("updateMyProfile", () => {
  beforeEach(() => {
    mockPrisma.patientProfile.update.mockReset();
  });

  it("updates the PATIENT's own profile row, keyed by their OWN userId — never a client-supplied id", async () => {
    mockPrisma.patientProfile.update.mockResolvedValue({ id: "profile-1", userId: "patient-1", address: "221B Baker St" });
    const actor = { id: "patient-1", roleCode: "PATIENT", hospitalId: null };

    await updateMyProfile(actor, { address: "221B Baker St" });

    expect(mockPrisma.patientProfile.update).toHaveBeenCalledWith({
      where: { userId: "patient-1" },
      data: { address: "221B Baker St" },
    });
  });

  it("rejects non-PATIENT actors even if this were ever called directly, bypassing the route guard", async () => {
    const actor = { id: "admin-1", roleCode: "ADMIN", hospitalId: "hospital-A" };

    await expect(updateMyProfile(actor, { address: "x" })).rejects.toThrow(ApiError);
    expect(mockPrisma.patientProfile.update).not.toHaveBeenCalled();
  });
});
