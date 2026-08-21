import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { usersApi, UserListItem } from "../../api/users.api";
import { invitationsApi, Invitation } from "../../api/invitations.api";
import { hospitalsApi, Hospital, Department } from "../../api/hospitals.api";
import { useAuth } from "../../context/AuthContext";
import { PERMISSIONS } from "../../constants/permissions";
import { PageHeader, StatusBadge, Pagination } from "../../components/UiPrimitives";
import { Modal } from "../../components/Modal";
import { Field, PrimaryButton, Alert } from "../../components/FormControls";

type TabKey = "DOCTOR" | "NURSE" | "DRIVER" | "PENDING";

const TABS: { key: TabKey; label: string }[] = [
  { key: "DOCTOR", label: "Doctors" },
  { key: "NURSE", label: "Nurses" },
  { key: "DRIVER", label: "Drivers" },
  { key: "PENDING", label: "Invitations" },
];

export default function StaffPage() {
  const { hasPermission, hasRole } = useAuth();
  const canInvite = hasPermission(PERMISSIONS.USER_CREATE_STAFF);
  const canView = hasPermission(PERMISSIONS.USER_VIEW);
  const isSuperAdmin = hasRole("SUPER_ADMIN");

  const [tab, setTab] = useState<TabKey>("DOCTOR");
  const [showInvite, setShowInvite] = useState(false);
  // Super Admin only: staff spans every hospital for them, unlike an Admin
  // who is already force-scoped to their own hospital server-side. Lives
  // here (not inside each tab) so switching tabs keeps the same hospital
  // selected.
  const [hospitalId, setHospitalId] = useState("");
  const [hospitals, setHospitals] = useState<Hospital[]>([]);

  useEffect(() => {
    if (isSuperAdmin) {
      hospitalsApi.list({ isActive: "true", pageSize: 100 }).then((res) => setHospitals(res.data?.items ?? []));
    }
  }, [isSuperAdmin]);

  return (
    <div className="p-8">
      <PageHeader
        title="Staff"
        subtitle="Doctors, nurses and drivers are onboarded by invitation"
        action={
          canInvite ? (
            <button onClick={() => setShowInvite(true)} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
              + Invite staff
            </button>
          ) : undefined
        }
      />

      <div className="mb-6 flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700">
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`border-b-2 px-4 py-2 text-sm font-medium transition ${
                tab === t.key ? "border-brand-600 text-brand-700 dark:text-brand-400" : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {isSuperAdmin && (
          <select
            value={hospitalId}
            onChange={(e) => setHospitalId(e.target.value)}
            className="mb-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All hospitals</option>
            {hospitals.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {!canView && tab !== "PENDING" ? (
        <Alert>You don't have permission to view staff lists.</Alert>
      ) : tab === "PENDING" ? (
        <PendingInvitationsTab canInvite={canInvite} hospitalId={isSuperAdmin ? hospitalId : undefined} />
      ) : (
        <StaffListTab roleCode={tab} hospitalId={isSuperAdmin ? hospitalId : undefined} />
      )}

      {showInvite && (
        <InviteStaffModal
          onClose={() => setShowInvite(false)}
          onCreated={() => setShowInvite(false)}
        />
      )}
    </div>
  );
}

function roleLabel(roleCode: "DOCTOR" | "NURSE" | "DRIVER", plural = true) {
  const labels: Record<string, [string, string]> = {
    DOCTOR: ["doctor", "doctors"],
    NURSE: ["nurse", "nurses"],
    DRIVER: ["driver", "drivers"],
  };
  return labels[roleCode][plural ? 1 : 0];
}

function StaffListTab({ roleCode, hospitalId }: { roleCode: "DOCTOR" | "NURSE" | "DRIVER"; hospitalId?: string }) {
  const { hasPermission } = useAuth();
  const canAssign = hasPermission(PERMISSIONS.PATIENT_ASSIGN);

  const [items, setItems] = useState<UserListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const pageSize = 10;

  // Debounce the raw input so we don't hit the API on every keystroke.
  useEffect(() => {
    const handle = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  // Any time the search term or hospital filter changes, jump back to page 1
  // so results aren't scoped to a page that no longer makes sense.
  useEffect(() => {
    setPage(1);
  }, [search, hospitalId]);

  const load = async () => {
    setIsLoading(true);
    try {
      const res = await usersApi.list({ roleCode, hospitalId: hospitalId || undefined, page, pageSize, search: search || undefined });
      setItems(res.data?.items ?? []);
      setTotal(res.data?.total ?? 0);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load staff");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleCode, page, search, hospitalId]);

  const toggleStatus = async (u: UserListItem) => {
    const next = u.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    await usersApi.updateStatus(u.id, next);
    load();
  };

  if (error) return <Alert>{error}</Alert>;

  return (
    <>
      <div className="mb-4">
        <div className="relative max-w-sm">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500"
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.35-5.15a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={`Search ${roleLabel(roleCode)} by name or email`}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 py-2 pl-9 pr-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Hospital</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Last login</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400 dark:text-slate-500">Loading...</td></tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400 dark:text-slate-500">
                  {search
                    ? `No ${roleLabel(roleCode)} match "${search}".`
                    : `No ${roleLabel(roleCode)} yet.`}
                </td>
              </tr>
            ) : (
              items.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{u.firstName} {u.lastName}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{u.email}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{u.hospital?.name ?? "—"}</td>
                  <td className="px-4 py-3"><StatusBadge value={u.status} /></td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "Never"}</td>
                  <td className="px-4 py-3 text-right">
                    {canAssign && roleCode !== "DRIVER" && (
                      <Link to={`/staff/${u.id}/patients`} className="mr-3 text-sm font-medium text-brand-600 hover:underline">
                        Manage patients
                      </Link>
                    )}
                    {u.status !== "DEACTIVATED" && (
                      <button onClick={() => toggleStatus(u)} className="text-sm font-medium text-brand-600 hover:underline">
                        {u.status === "ACTIVE" ? "Suspend" : "Activate"}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
    </>
  );
}

function PendingInvitationsTab({ canInvite, hospitalId }: { canInvite: boolean; hospitalId?: string }) {
  const [items, setItems] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      const res = await invitationsApi.list(hospitalId || undefined);
      setItems(res.data ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load invitations");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hospitalId]);

  const handleRevoke = async (invitation: Invitation) => {
    if (!confirm(`Revoke the invitation sent to ${invitation.email}?`)) return;
    try {
      await invitationsApi.revoke(invitation.id);
      load();
    } catch (err: any) {
      alert(err?.message ?? "Failed to revoke invitation");
    }
  };

  if (error) return <Alert>{error}</Alert>;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <tr>
            <th className="px-4 py-3">Email</th>
            <th className="px-4 py-3">Role</th>
            <th className="px-4 py-3">Invited by</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Expires</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
          {isLoading ? (
            <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400 dark:text-slate-500">Loading...</td></tr>
          ) : items.length === 0 ? (
            <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400 dark:text-slate-500">No invitations sent yet.</td></tr>
          ) : (
            items.map((inv) => (
              <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{inv.email}</td>
                <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{inv.role.name}</td>
                <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{inv.invitedBy.firstName} {inv.invitedBy.lastName}</td>
                <td className="px-4 py-3"><StatusBadge value={inv.status} /></td>
                <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{new Date(inv.expiresAt).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right">
                  {canInvite && inv.status === "PENDING" && (
                    <button onClick={() => handleRevoke(inv)} className="text-sm font-medium text-red-600 hover:underline">
                      Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

const inviteSchema = z.object({
  email: z.string().email("Enter a valid email"),
  roleCode: z.enum(["DOCTOR", "NURSE", "DRIVER"]),
  hospitalId: z.string().optional(),
  departmentId: z.string().optional(),
});
type InviteValues = z.infer<typeof inviteSchema>;

function InviteStaffModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [ownHospital, setOwnHospital] = useState<Hospital | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { roleCode: "DOCTOR" },
  });

  // Super Admin can target any hospital via the dropdown. An Admin is always
  // scoped to their own hospital — the backend enforces this regardless, but
  // we don't even show them a choice that would just get overridden.
  const effectiveHospitalId = isSuperAdmin ? watch("hospitalId") : user?.hospitalId ?? undefined;

  useEffect(() => {
    if (isSuperAdmin) {
      hospitalsApi.list({ isActive: "true", pageSize: 100 }).then((res) => setHospitals(res.data?.items ?? []));
    } else if (user?.hospitalId) {
      hospitalsApi.get(user.hospitalId).then((res) => setOwnHospital(res.data ?? null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!effectiveHospitalId) {
      setDepartments([]);
      return;
    }
    hospitalsApi.get(effectiveHospitalId).then((res) => setDepartments(res.data?.departments ?? []));
  }, [effectiveHospitalId]);

  const onSubmit = async (values: InviteValues) => {
    setServerError(null);
    try {
      const res = await invitationsApi.create({
        email: values.email,
        roleCode: values.roleCode,
        hospitalId: isSuperAdmin ? values.hospitalId || undefined : undefined, // Admin: server auto-scopes
        departmentId: values.departmentId || undefined,
      });
      setSuccess(`Invitation sent to ${res.data?.email}.`);
      setTimeout(onCreated, 1200);
    } catch (err: any) {
      setServerError(err?.message ?? "Failed to send invitation");
    }
  };

  if (!isSuperAdmin && !user?.hospitalId) {
    return (
      <Modal title="Invite staff" onClose={onClose}>
        <Alert>Your account isn't linked to a hospital yet — contact a super admin before inviting staff.</Alert>
      </Modal>
    );
  }

  return (
    <Modal title="Invite staff" onClose={onClose}>
      {serverError && <Alert>{serverError}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Role</label>
          <select {...register("roleCode")} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand-500">
            <option value="DOCTOR">Doctor</option>
            <option value="NURSE">Nurse</option>
            <option value="DRIVER">Driver</option>
          </select>
        </div>

        <Field label="Email" type="email" error={errors.email?.message} {...register("email")} />

        {isSuperAdmin ? (
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Hospital (optional)</label>
            <select {...register("hospitalId")} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand-500">
              <option value="">— Unassigned —</option>
              {hospitals.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Hospital</label>
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm text-slate-600 dark:text-slate-300">
              {ownHospital?.name ?? "Your hospital"}
            </div>
          </div>
        )}

        {effectiveHospitalId && (
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Department (optional)</label>
            <select {...register("departmentId")} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand-500">
              <option value="">— None —</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        )}

        <PrimaryButton type="submit" isLoading={isSubmitting}>Send invitation</PrimaryButton>
      </form>
    </Modal>
  );
}