import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { usersApi, UserListItem } from "../../api/users.api";
import { patientsApi } from "../../api/patients.api";
import { hospitalsApi, Hospital, Department } from "../../api/hospitals.api";
import { useAuth } from "../../context/AuthContext";
import { PageHeader, StatusBadge, Pagination } from "../../components/UiPrimitives";
import { Modal } from "../../components/Modal";
import { Field, PrimaryButton, Alert } from "../../components/FormControls";

export default function PatientsPage() {
  const { user, hasRole } = useAuth();
  const isSuperAdmin = hasRole("SUPER_ADMIN");

  const [showInvite, setShowInvite] = useState(false);
  // Super Admin only: patients span every hospital for them, unlike an
  // Admin who is already force-scoped to their own hospital server-side.
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
        title="Patients"
        subtitle="Patients are onboarded by an admin — a temporary password is emailed to them"
        action={
          <button
            onClick={() => setShowInvite(true)}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            + Add patient
          </button>
        }
      />

      {isSuperAdmin && (
        <div className="mb-4">
          <select
            value={hospitalId}
            onChange={(e) => setHospitalId(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All hospitals</option>
            {hospitals.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <PatientsListTab hospitalId={isSuperAdmin ? hospitalId : undefined} />

      {showInvite && <AddPatientModal onClose={() => setShowInvite(false)} onCreated={() => setShowInvite(false)} />}
    </div>
  );
}

function PatientsListTab({ hospitalId }: { hospitalId?: string }) {
  const [items, setItems] = useState<UserListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const pageSize = 10;

  useEffect(() => {
    const handle = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [search, hospitalId]);

  const load = async () => {
    setIsLoading(true);
    try {
      const res = await usersApi.list({ roleCode: "PATIENT", hospitalId: hospitalId || undefined, page, pageSize, search: search || undefined });
      setItems(res.data?.items ?? []);
      setTotal(res.data?.total ?? 0);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load patients");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, hospitalId]);

  const toggleStatus = async (u: UserListItem) => {
    const next = u.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    await usersApi.updateStatus(u.id, next);
    load();
  };

  const handleResend = async (u: UserListItem) => {
    if (!confirm(`Send a new temporary password to ${u.email}?`)) return;
    setResendingId(u.id);
    setResendMessage(null);
    try {
      await patientsApi.resendCredentials(u.id);
      setResendMessage(`New temporary credentials sent to ${u.email}.`);
      load();
    } catch (err: any) {
      alert(err?.message ?? "Failed to resend credentials");
    } finally {
      setResendingId(null);
    }
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
            placeholder="Search patients by name or email"
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 py-2 pl-9 pr-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>

      {resendMessage && <Alert variant="success">{resendMessage}</Alert>}

      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Hospital</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">First login</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400 dark:text-slate-500">Loading...</td></tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400 dark:text-slate-500">
                  {search ? `No patients match "${search}".` : "No patients yet. Use \u201c+ Add patient\u201d to create one."}
                </td>
              </tr>
            ) : (
              items.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{u.firstName} {u.lastName}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{u.email}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{u.hospital?.name ?? "—"}</td>
                  <td className="px-4 py-3"><StatusBadge value={u.status} /></td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                    {u.mustChangePassword ? (
                      <span className="inline-block rounded-full bg-amber-50 dark:bg-amber-900/30 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                        Pending
                      </span>
                    ) : (
                      "Completed"
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {u.mustChangePassword && u.status !== "DEACTIVATED" && (
                      <button
                        onClick={() => handleResend(u)}
                        disabled={resendingId === u.id}
                        className="mr-3 text-sm font-medium text-brand-600 hover:underline disabled:opacity-50"
                      >
                        {resendingId === u.id ? "Sending..." : "Resend credentials"}
                      </button>
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

const addPatientSchema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().optional(),
  hospitalId: z.string().optional(),
});
type AddPatientValues = z.infer<typeof addPatientSchema>;

function AddPatientModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [ownHospital, setOwnHospital] = useState<Hospital | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AddPatientValues>({ resolver: zodResolver(addPatientSchema) });

  useEffect(() => {
    if (isSuperAdmin) {
      hospitalsApi.list({ isActive: "true", pageSize: 100 }).then((res) => setHospitals(res.data?.items ?? []));
    } else if (user?.hospitalId) {
      hospitalsApi.get(user.hospitalId).then((res) => setOwnHospital(res.data ?? null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = async (values: AddPatientValues) => {
    setServerError(null);
    try {
      const res = await patientsApi.create({
        email: values.email,
        firstName: values.firstName,
        lastName: values.lastName,
        phone: values.phone || undefined,
        hospitalId: isSuperAdmin ? values.hospitalId || undefined : undefined, // Admin: server auto-scopes
      });
      setSuccess(`Patient account created for ${res.data?.email}. A temporary password was emailed to them.`);
      setTimeout(onCreated, 1500);
    } catch (err: any) {
      setServerError(err?.message ?? "Failed to create patient");
    }
  };

  if (!isSuperAdmin && !user?.hospitalId) {
    return (
      <Modal title="Add patient" onClose={onClose}>
        <Alert>Your account isn't linked to a hospital yet — contact a super admin before adding patients.</Alert>
      </Modal>
    );
  }

  return (
    <Modal title="Add patient" onClose={onClose}>
      {serverError && <Alert>{serverError}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" error={errors.firstName?.message} {...register("firstName")} />
          <Field label="Last name" error={errors.lastName?.message} {...register("lastName")} />
        </div>
        <Field label="Email" type="email" error={errors.email?.message} {...register("email")} />
        <Field label="Phone (optional)" type="tel" error={errors.phone?.message} {...register("phone")} />

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

        <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
          A temporary password will be emailed to the patient. They'll be asked to set their own password on first
          login, and the temporary one expires after a short window for security.
        </p>

        <PrimaryButton type="submit" isLoading={isSubmitting}>Create patient account</PrimaryButton>
      </form>
    </Modal>
  );
}
