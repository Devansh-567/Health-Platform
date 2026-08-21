import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { rolesApi, RoleListItem } from "../../api/roles.api";
import { PageHeader, StatusBadge } from "../../components/UiPrimitives";
import { Modal } from "../../components/Modal";
import { Field, PrimaryButton, Alert } from "../../components/FormControls";

const createSchema = z.object({
  code: z
    .string()
    .min(2, "Required")
    .max(50)
    .regex(/^[A-Z_]+$/, "Use UPPER_SNAKE_CASE"),
  name: z.string().min(2, "Required").max(100),
  description: z.string().max(500).optional(),
});
type CreateValues = z.infer<typeof createSchema>;

export default function RolesPage() {
  const [items, setItems] = useState<RoleListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      const res = await rolesApi.list();
      setItems(res.data ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load roles");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="p-8">
      <PageHeader
        title="Roles & Permissions"
        subtitle="Control what each role can see and do — changes take effect immediately"
        action={
          <button onClick={() => setShowCreate(true)} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            + New role
          </button>
        }
      />

      {error && <Alert>{error}</Alert>}

      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Permissions</th>
              <th className="px-4 py-3">Users</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400 dark:text-slate-500">Loading...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400 dark:text-slate-500">No roles yet.</td></tr>
            ) : (
              items.map((role) => (
                <tr key={role.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">
                    <Link to={`/roles/${role.id}`} className="hover:text-brand-600 hover:underline">{role.name}</Link>
                    {role.description && <p className="mt-0.5 text-xs font-normal text-slate-500 dark:text-slate-400">{role.description}</p>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">{role.code}</td>
                  <td className="px-4 py-3"><StatusBadge value={role.isSystem ? "SYSTEM" : "CUSTOM"} /></td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{role._count.rolePermissions}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{role._count.users}</td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/roles/${role.id}`} className="text-sm font-medium text-brand-600 hover:underline">
                      Manage permissions
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <CreateRoleModal
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

function CreateRoleModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
  });

  const onSubmit = async (values: CreateValues) => {
    setServerError(null);
    try {
      await rolesApi.create(values);
      onCreated();
    } catch (err: any) {
      setServerError(err?.message ?? "Failed to create role");
    }
  };

  return (
    <Modal title="New role" onClose={onClose}>
      {serverError && <Alert>{serverError}</Alert>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field label="Code (unique)" placeholder="e.g. BILLING_CLERK" error={errors.code?.message} {...register("code")} />
        <Field label="Display name" error={errors.name?.message} {...register("name")} />
        <Field label="Description (optional)" error={errors.description?.message} {...register("description")} />
        <PrimaryButton type="submit" isLoading={isSubmitting}>Create role</PrimaryButton>
      </form>
    </Modal>
  );
}
