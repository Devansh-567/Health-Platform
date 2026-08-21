import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { usersApi, UserListItem } from "../../api/users.api";
import { hospitalsApi, Hospital } from "../../api/hospitals.api";
import { PageHeader, StatusBadge, Pagination } from "../../components/UiPrimitives";
import { Modal } from "../../components/Modal";
import { Field, PrimaryButton, Alert } from "../../components/FormControls";

export default function AdminsPage() {
  const [items, setItems] = useState<UserListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const pageSize = 10;

  const load = async () => {
    setIsLoading(true);
    try {
      const res = await usersApi.list({ roleCode: "ADMIN", page, pageSize });
      setItems(res.data?.items ?? []);
      setTotal(res.data?.total ?? 0);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load admins");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const toggleStatus = async (u: UserListItem) => {
    const next = u.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    await usersApi.updateStatus(u.id, next);
    load();
  };

  return (
    <div className="p-8">
      <PageHeader
        title="Admins"
        subtitle="Hospital administrators created directly by Super Admin"
        action={
          <button onClick={() => setShowCreate(true)} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            + Add admin
          </button>
        }
      />

      {error && <Alert>{error}</Alert>}

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
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400 dark:text-slate-500">No admins yet.</td></tr>
            ) : (
              items.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{u.firstName} {u.lastName}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{u.email}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{u.hospital?.name ?? "—"}</td>
                  <td className="px-4 py-3"><StatusBadge value={u.status} /></td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "Never"}</td>
                  <td className="px-4 py-3 text-right">
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

      {showCreate && (
        <CreateAdminModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}
    </div>
  );
}

const passwordRule = z
  .string()
  .min(10, "At least 10 characters")
  .regex(/[a-z]/, "Needs a lowercase letter")
  .regex(/[A-Z]/, "Needs an uppercase letter")
  .regex(/[0-9]/, "Needs a number")
  .regex(/[^a-zA-Z0-9]/, "Needs a special character");

const createSchema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().optional(),
  hospitalId: z.string().optional(),
  temporaryPassword: passwordRule,
});
type CreateValues = z.infer<typeof createSchema>;

function CreateAdminModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
  });

  useEffect(() => {
    hospitalsApi.list({ isActive: "true", pageSize: 100 }).then((res) => setHospitals(res.data?.items ?? []));
  }, []);

  const onSubmit = async (values: CreateValues) => {
    setServerError(null);
    try {
      await usersApi.createAdmin({ ...values, hospitalId: values.hospitalId || undefined, phone: values.phone || undefined });
      onCreated();
    } catch (err: any) {
      setServerError(err?.message ?? "Failed to create admin");
    }
  };

  return (
    <Modal title="Add admin" onClose={onClose}>
      {serverError && <Alert>{serverError}</Alert>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" error={errors.firstName?.message} {...register("firstName")} />
          <Field label="Last name" error={errors.lastName?.message} {...register("lastName")} />
        </div>
        <Field label="Email" type="email" error={errors.email?.message} {...register("email")} />
        <Field label="Phone (optional)" type="tel" error={errors.phone?.message} {...register("phone")} />

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Hospital (optional)</label>
          <select {...register("hospitalId")} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand-500">
            <option value="">— Unassigned —</option>
            {hospitals.map((h) => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
        </div>

        <Field
          label="Temporary password"
          type="text"
          error={errors.temporaryPassword?.message}
          {...register("temporaryPassword")}
        />
        <p className="-mt-3 mb-4 text-xs text-slate-500 dark:text-slate-400">Admin will be required to change this on first login.</p>

        <PrimaryButton type="submit" isLoading={isSubmitting}>Create admin</PrimaryButton>
      </form>
    </Modal>
  );
}