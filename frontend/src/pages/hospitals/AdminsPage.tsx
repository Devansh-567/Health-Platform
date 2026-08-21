import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { hospitalsApi, Hospital } from "../../api/hospitals.api";
import { PageHeader, StatusBadge, Pagination } from "../../components/UiPrimitives";
import { Modal } from "../../components/Modal";
import { Field, PrimaryButton, Alert } from "../../components/FormControls";

const createSchema = z.object({
  name: z.string().min(2, "Required"),
  code: z
    .string()
    .min(2, "Required")
    .regex(/^[A-Z0-9_-]+$/, "Uppercase letters, numbers, - or _ only"),
  address: z.string().optional(),
  phone: z.string().optional(),
});
type CreateValues = z.infer<typeof createSchema>;

export default function HospitalsPage() {
  const [items, setItems] = useState<Hospital[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 10;

  const load = async () => {
    setIsLoading(true);
    try {
      const res = await hospitalsApi.list({ search: search || undefined, page, pageSize });
      setItems(res.data?.items ?? []);
      setTotal(res.data?.total ?? 0);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load hospitals");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    load();
  };

  const toggleStatus = async (hospital: Hospital) => {
    await hospitalsApi.setStatus(hospital.id, !hospital.isActive);
    load();
  };

  return (
    <div className="p-8">
      <PageHeader
        title="Hospitals"
        subtitle="Manage hospital facilities and their departments"
        action={
          <button onClick={() => setShowCreate(true)} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            + Add hospital
          </button>
        }
      />

      {error && <Alert>{error}</Alert>}

      <form onSubmit={handleSearch} className="mb-4 flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or code..."
          className="w-72 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
        />
        <button type="submit" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
          Search
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Departments</th>
              <th className="px-4 py-3">Users</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Loading...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">No hospitals yet.</td></tr>
            ) : (
              items.map((h) => (
                <tr key={h.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">
                    <Link to={`/hospitals/${h.id}`} className="hover:text-brand-600 hover:underline">{h.name}</Link>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{h.code}</td>
                  <td className="px-4 py-3 text-slate-500">{h._count?.departments ?? 0}</td>
                  <td className="px-4 py-3 text-slate-500">{h._count?.users ?? 0}</td>
                  <td className="px-4 py-3"><StatusBadge value={h.isActive} /></td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => toggleStatus(h)} className="text-sm font-medium text-brand-600 hover:underline">
                      {h.isActive ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />

      {showCreate && (
        <CreateHospitalModal
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

function CreateHospitalModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
  });

  const onSubmit = async (values: CreateValues) => {
    setServerError(null);
    try {
      await hospitalsApi.create(values);
      onCreated();
    } catch (err: any) {
      setServerError(err?.message ?? "Failed to create hospital");
    }
  };

  return (
    <Modal title="Add hospital" onClose={onClose}>
      {serverError && <Alert>{serverError}</Alert>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field label="Hospital name" error={errors.name?.message} {...register("name")} />
        <Field label="Code (unique)" placeholder="e.g. HMS-BLR-01" error={errors.code?.message} {...register("code")} />
        <Field label="Address (optional)" error={errors.address?.message} {...register("address")} />
        <Field label="Phone (optional)" error={errors.phone?.message} {...register("phone")} />
        <PrimaryButton type="submit" isLoading={isSubmitting}>Create hospital</PrimaryButton>
      </form>
    </Modal>
  );
}