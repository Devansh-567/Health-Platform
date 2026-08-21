import { describe, it, expect, vi } from "vitest";
import { requirePermission, requireRole } from "../rbac";
import { ApiError } from "../../utils/ApiError";

function makeReq(user?: { permissions?: string[]; roleCode?: string }) {
  return { user: user as any } as any;
}

describe("requirePermission", () => {
  it("calls next() with no error when the user has one of the required permissions", () => {
    const req = makeReq({ permissions: ["patient.view.assigned", "vitals.record"] });
    const next = vi.fn();

    requirePermission("vitals.record")(req, {} as any, next);

    expect(next).toHaveBeenCalledWith(); // called with no arguments = success
  });

  it("succeeds if the user has ANY ONE of multiple accepted permissions", () => {
    const req = makeReq({ permissions: ["medical_note.create"] });
    const next = vi.fn();

    requirePermission("medical_note.create", "nursing_note.create")(req, {} as any, next);

    expect(next).toHaveBeenCalledWith();
  });

  it("rejects with 403 when the user has none of the required permissions", () => {
    const req = makeReq({ permissions: ["patient.view.own"] });
    const next = vi.fn();

    requirePermission("patient.assign")(req, {} as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0] as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.statusCode).toBe(403);
  });

  it("rejects with 401 when there is no authenticated user at all", () => {
    const req = makeReq(undefined);
    const next = vi.fn();

    requirePermission("patient.assign")(req, {} as any, next);

    const err = next.mock.calls[0][0] as ApiError;
    expect(err.statusCode).toBe(401);
  });

  it("rejects a user with an empty permission list", () => {
    const req = makeReq({ permissions: [] });
    const next = vi.fn();

    requirePermission("hospital.manage")(req, {} as any, next);

    const err = next.mock.calls[0][0] as ApiError;
    expect(err.statusCode).toBe(403);
  });
});

describe("requireRole", () => {
  it("passes when the user's role is in the allowed list", () => {
    const req = makeReq({ roleCode: "ADMIN" });
    const next = vi.fn();

    requireRole("ADMIN", "SUPER_ADMIN")(req, {} as any, next);

    expect(next).toHaveBeenCalledWith();
  });

  it("rejects with 403 when the user's role is not in the allowed list", () => {
    const req = makeReq({ roleCode: "PATIENT" });
    const next = vi.fn();

    requireRole("ADMIN", "SUPER_ADMIN")(req, {} as any, next);

    const err = next.mock.calls[0][0] as ApiError;
    expect(err.statusCode).toBe(403);
  });

  it("rejects with 401 when there is no authenticated user", () => {
    const req = makeReq(undefined);
    const next = vi.fn();

    requireRole("SUPER_ADMIN")(req, {} as any, next);

    const err = next.mock.calls[0][0] as ApiError;
    expect(err.statusCode).toBe(401);
  });
});