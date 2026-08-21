import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = {
  rolePermission: { findMany: vi.fn() },
  userPermission: { findMany: vi.fn() },
};

vi.mock("../../../config/prisma", () => ({ prisma: mockPrisma }));

// Imported after the mock is registered so the module under test picks up
// the mocked prisma singleton instead of the real one.
const { resolveEffectivePermissions } = await import("../permission.service");

describe("resolveEffectivePermissions", () => {
  beforeEach(() => {
    mockPrisma.rolePermission.findMany.mockReset();
    mockPrisma.userPermission.findMany.mockReset();
  });

  it("returns exactly the role's permissions when there are no overrides", async () => {
    mockPrisma.rolePermission.findMany.mockResolvedValue([
      { permission: { code: "patient.view.assigned" } },
      { permission: { code: "prescription.view" } },
    ]);
    mockPrisma.userPermission.findMany.mockResolvedValue([]);

    const result = await resolveEffectivePermissions("user-1", "role-doctor");

    expect(result.sort()).toEqual(["patient.view.assigned", "prescription.view"]);
  });

  it("adds a GRANT override even if the role doesn't have that permission", async () => {
    mockPrisma.rolePermission.findMany.mockResolvedValue([{ permission: { code: "prescription.view" } }]);
    mockPrisma.userPermission.findMany.mockResolvedValue([
      { effect: "GRANT", permission: { code: "audit.view" } },
    ]);

    const result = await resolveEffectivePermissions("user-1", "role-nurse");

    expect(result).toContain("prescription.view");
    expect(result).toContain("audit.view");
  });

  it("removes a permission the role grants when a REVOKE override targets it", async () => {
    mockPrisma.rolePermission.findMany.mockResolvedValue([
      { permission: { code: "prescription.view" } },
      { permission: { code: "vitals.record" } },
    ]);
    mockPrisma.userPermission.findMany.mockResolvedValue([
      { effect: "REVOKE", permission: { code: "vitals.record" } },
    ]);

    const result = await resolveEffectivePermissions("user-1", "role-nurse");

    expect(result).toContain("prescription.view");
    expect(result).not.toContain("vitals.record");
  });

  it("a REVOKE with no matching role permission is a harmless no-op", async () => {
    mockPrisma.rolePermission.findMany.mockResolvedValue([{ permission: { code: "prescription.view" } }]);
    mockPrisma.userPermission.findMany.mockResolvedValue([
      { effect: "REVOKE", permission: { code: "audit.view" } }, // role never had this anyway
    ]);

    const result = await resolveEffectivePermissions("user-1", "role-nurse");

    expect(result).toEqual(["prescription.view"]);
  });

  it("does not duplicate a permission granted both by role and by a GRANT override", async () => {
    mockPrisma.rolePermission.findMany.mockResolvedValue([{ permission: { code: "prescription.view" } }]);
    mockPrisma.userPermission.findMany.mockResolvedValue([
      { effect: "GRANT", permission: { code: "prescription.view" } },
    ]);

    const result = await resolveEffectivePermissions("user-1", "role-doctor");

    expect(result.filter((p) => p === "prescription.view")).toHaveLength(1);
  });

  it("returns an empty list for a role with no permissions and no overrides", async () => {
    mockPrisma.rolePermission.findMany.mockResolvedValue([]);
    mockPrisma.userPermission.findMany.mockResolvedValue([]);

    const result = await resolveEffectivePermissions("user-1", "role-empty");

    expect(result).toEqual([]);
  });
});