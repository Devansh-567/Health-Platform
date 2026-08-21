import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = {
  user: { findMany: vi.fn(), count: vi.fn() },
};

vi.mock("../../../config/prisma", () => ({ prisma: mockPrisma }));

const { listUsers } = await import("../users.service");

const baseFilters = { page: 1, pageSize: 20 };

describe("listUsers hospital scoping — regression guard", () => {
  beforeEach(() => {
    mockPrisma.user.findMany.mockReset().mockResolvedValue([]);
    mockPrisma.user.count.mockReset().mockResolvedValue(0);
  });

  it("ADMIN is forced to their own hospital even if they request a different one", async () => {
    const actor = { roleCode: "ADMIN", hospitalId: "hospital-A" };

    await listUsers(actor, { ...baseFilters, hospitalId: "hospital-B" });

    const where = mockPrisma.user.findMany.mock.calls[0][0].where;
    expect(where.hospitalId).toBe("hospital-A"); // never "hospital-B"
  });

  it("ADMIN with no hospitalId query param still only sees their own hospital", async () => {
    const actor = { roleCode: "ADMIN", hospitalId: "hospital-A" };

    await listUsers(actor, baseFilters);

    const where = mockPrisma.user.findMany.mock.calls[0][0].where;
    expect(where.hospitalId).toBe("hospital-A");
  });

  it("SUPER_ADMIN's explicit hospitalId filter is honored (they're allowed to cross hospitals)", async () => {
    const actor = { roleCode: "SUPER_ADMIN", hospitalId: null };

    await listUsers(actor, { ...baseFilters, hospitalId: "hospital-B" });

    const where = mockPrisma.user.findMany.mock.calls[0][0].where;
    expect(where.hospitalId).toBe("hospital-B");
  });

  it("SUPER_ADMIN with no filter sees all hospitals (no hospitalId in the where clause)", async () => {
    const actor = { roleCode: "SUPER_ADMIN", hospitalId: null };

    await listUsers(actor, baseFilters);

    const where = mockPrisma.user.findMany.mock.calls[0][0].where;
    expect(where.hospitalId).toBeUndefined();
  });
});