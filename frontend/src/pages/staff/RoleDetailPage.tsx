import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { rolesApi, PermissionItem, RoleWithPermissions } from "../../api/roles.api";
import { PageHeader, StatusBadge } from "../../components/UiPrimitives";
import { Alert, PrimaryButton } from "../../components/FormControls";

export default function RoleDetailPage() {
  const { roleId = "" } = useParams();
  const [role, setRole] = useState<RoleWithPermissions | null>(null);
  const [catalog, setCatalog] = useState<PermissionItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [roleRes, permsRes] = await Promise.all([rolesApi.get(roleId), rolesApi.listPermissions()]);
      const r = roleRes.data ?? null;
      setRole(r);
      setCatalog(permsRes.data ?? []);
      setSelected(new Set((r?.rolePermissions ?? []).map((rp) => rp.permission.code)));
    } catch (err: any) {
      setError(err?.message ?? "Failed to load role");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleId]);

  const grouped = useMemo(() => {
    const byModule = new Map<string, PermissionItem[]>();
    for (const perm of catalog) {
      const list = byModule.get(perm.module) ?? [];
      list.push(perm);
      byModule.set(perm.module, list);
    }
    return [...byModule.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [catalog]);

  const originalCodes = useMemo(
    () => new Set((role?.rolePermissions ?? []).map((rp) => rp.permission.code)),
    [role]
  );
  const isDirty = useMemo(() => {
    if (selected.size !== originalCodes.size) return true;
    for (const code of selected) if (!originalCodes.has(code)) return true;
    return false;
  }, [selected, originalCodes]);

  const locked = role?.code === "SUPER_ADMIN";

  const toggle = (code: string) => {
    if (locked) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const toggleModule = (perms: PermissionItem[], checkAll: boolean) => {
    if (locked) return;
    setSelected((prev) => {
      const next = new Set(prev);
      for (const p of perms) {
        if (checkAll) next.add(p.code);
        else next.delete(p.code);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await rolesApi.updatePermissions(roleId, [...selected]);
      setSuccess("Permissions updated.");
      await load();
    } catch (err: any) {
      setError(err?.message ?? "Failed to update permissions");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="p-8 text-slate-400 dark:text-slate-500">Loading...</div>;
  if (error && !role) return <div className="p-8"><Alert>{error}</Alert></div>;
  if (!role) return null;

  return (
    <div className="p-8">
      <Link to="/roles" className="mb-4 inline-block text-sm text-brand-600 hover:underline">
        ← Back to roles
      </Link>

      <PageHeader
        title={role.name}
        subtitle={`Code: ${role.code}`}
        action={<StatusBadge value={role.isSystem ? "SYSTEM" : "CUSTOM"} />}
      />

      {error && <Alert>{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {locked && (
        <Alert>Super Admin permissions are fixed and cannot be modified — this role always has full system access.</Alert>
      )}

      <div className="space-y-6">
        {grouped.map(([module, perms]) => {
          const allChecked = perms.every((p) => selected.has(p.code));
          return (
            <div key={module} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {module.replaceAll("_", " ")}
                </h2>
                {!locked && (
                  <button
                    onClick={() => toggleModule(perms, !allChecked)}
                    className="text-xs font-medium text-brand-600 hover:underline"
                  >
                    {allChecked ? "Clear all" : "Select all"}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {perms.map((perm) => (
                  <label
                    key={perm.code}
                    className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                      locked ? "border-slate-200 dark:border-slate-700 opacity-60" : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(perm.code)}
                      onChange={() => toggle(perm.code)}
                      disabled={locked}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-brand-600 focus:ring-brand-500"
                    />
                    <span>
                      <span className="block font-medium text-slate-800 dark:text-slate-100">{perm.code}</span>
                      {perm.description && <span className="block text-xs text-slate-500 dark:text-slate-400">{perm.description}</span>}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {!locked && (
        <div className="sticky bottom-6 mt-6 flex justify-end">
          <div className="w-56">
            <PrimaryButton onClick={handleSave} isLoading={isSaving} disabled={!isDirty}>
              Save changes
            </PrimaryButton>
          </div>
        </div>
      )}
    </div>
  );
}
