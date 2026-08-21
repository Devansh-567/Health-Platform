import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { hospitalsApi, Department, Hospital } from "../../api/hospitals.api";
import { PageHeader, StatusBadge } from "../../components/UiPrimitives";
import { Modal } from "../../components/Modal";
import { Field, PrimaryButton, Alert } from "../../components/FormControls";

type HospitalWithDepartments = Hospital & { departments: Department[] };

export default function HospitalDetailPage() {
  const { hospitalId = "" } = useParams();
  const [hospital, setHospital] = useState<HospitalWithDepartments | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddDept, setShowAddDept] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [showEditCoords, setShowEditCoords] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      const res = await hospitalsApi.get(hospitalId);
      setHospital((res.data as HospitalWithDepartments) ?? null);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load hospital");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hospitalId]);

  const handleDeleteDept = async (dept: Department) => {
    if (!confirm(`Delete department "${dept.name}"?`)) return;
    try {
      await hospitalsApi.deleteDepartment(hospitalId, dept.id);
      load();
    } catch (err: any) {
      alert(err?.message ?? "Failed to delete department");
    }
  };

  if (isLoading) return <div className="p-8 text-slate-400 dark:text-slate-500">Loading...</div>;
  if (error || !hospital) return <div className="p-8"><Alert>{error ?? "Hospital not found"}</Alert></div>;

  return (
    <div className="p-8">
      <Link to="/hospitals" className="mb-4 inline-block text-sm text-brand-600 hover:underline">
        ← Back to hospitals
      </Link>

      <PageHeader
        title={hospital.name}
        subtitle={`Code: ${hospital.code}`}
        action={<StatusBadge value={hospital.isActive} />}
      />

      <div className="mb-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Details</h2>
          <button onClick={() => setShowEditCoords(true)} className="text-xs font-medium text-brand-600 hover:underline">
            Edit coordinates
          </button>
        </div>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-slate-500 dark:text-slate-400">Address</dt>
            <dd className="text-slate-800 dark:text-slate-100">{hospital.address || "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500 dark:text-slate-400">Phone</dt>
            <dd className="text-slate-800 dark:text-slate-100">{hospital.phone || "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500 dark:text-slate-400">Coordinates</dt>
            <dd className="text-slate-800 dark:text-slate-100">
              {hospital.latitude != null && hospital.longitude != null
                ? `${hospital.latitude.toFixed(5)}, ${hospital.longitude.toFixed(5)}`
                : "Not set — ambulance dispatch to/from this hospital is blocked until set"}
            </dd>
          </div>
        </dl>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Departments</h2>
        <button onClick={() => setShowAddDept(true)} className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700">
          + Add department
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Users assigned</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {hospital.departments.length === 0 ? (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-400 dark:text-slate-500">No departments yet.</td></tr>
            ) : (
              hospital.departments.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{d.name}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{d._count?.users ?? 0}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setEditingDept(d)} className="mr-3 text-sm font-medium text-brand-600 hover:underline">
                      Rename
                    </button>
                    <button onClick={() => handleDeleteDept(d)} className="text-sm font-medium text-red-600 hover:underline">
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showAddDept && (
        <DepartmentModal
          title="Add department"
          hospitalId={hospitalId}
          onClose={() => setShowAddDept(false)}
          onSaved={() => {
            setShowAddDept(false);
            load();
          }}
        />
      )}

      {editingDept && (
        <DepartmentModal
          title="Rename department"
          hospitalId={hospitalId}
          department={editingDept}
          onClose={() => setEditingDept(null)}
          onSaved={() => {
            setEditingDept(null);
            load();
          }}
        />
      )}

      {showEditCoords && (
        <EditCoordinatesModal
          hospitalId={hospitalId}
          hospital={hospital}
          onClose={() => setShowEditCoords(false)}
          onSaved={() => {
            setShowEditCoords(false);
            load();
          }}
        />
      )}
    </div>
  );
}

const coordsSchema = z.object({
  latitude: z.string().min(1, "Required"),
  longitude: z.string().min(1, "Required"),
});
type CoordsValues = z.infer<typeof coordsSchema>;

function EditCoordinatesModal({
  hospitalId,
  hospital,
  onClose,
  onSaved,
}: {
  hospitalId: string;
  hospital: Hospital;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CoordsValues>({
    resolver: zodResolver(coordsSchema),
    defaultValues: {
      latitude: hospital.latitude != null ? String(hospital.latitude) : "",
      longitude: hospital.longitude != null ? String(hospital.longitude) : "",
    },
  });

  const onSubmit = async (values: CoordsValues) => {
    setServerError(null);
    const lat = Number(values.latitude);
    const lng = Number(values.longitude);
    if (Number.isNaN(lat) || lat < -90 || lat > 90) {
      setServerError("Latitude must be a number between -90 and 90");
      return;
    }
    if (Number.isNaN(lng) || lng < -180 || lng > 180) {
      setServerError("Longitude must be a number between -180 and 180");
      return;
    }
    try {
      await hospitalsApi.update(hospitalId, { latitude: lat, longitude: lng });
      onSaved();
    } catch (err: any) {
      setServerError(err?.message ?? "Failed to update coordinates");
    }
  };

  return (
    <Modal title="Edit coordinates" onClose={onClose}>
      {serverError && <Alert>{serverError}</Alert>}
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        Used as the ambulance dispatch origin/destination for this hospital and to place it on the live tracking map.
        Look up coordinates on any map service (right-click a location → "What's here?" on Google Maps, or check its URL).
      </p>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Latitude" type="number" step="any" placeholder="18.5204" error={errors.latitude?.message} {...register("latitude")} />
          <Field label="Longitude" type="number" step="any" placeholder="73.8567" error={errors.longitude?.message} {...register("longitude")} />
        </div>
        <PrimaryButton type="submit" isLoading={isSubmitting}>Save coordinates</PrimaryButton>
      </form>
    </Modal>
  );
}

const deptSchema = z.object({ name: z.string().min(2, "Required") });
type DeptValues = z.infer<typeof deptSchema>;

function DepartmentModal({
  title,
  hospitalId,
  department,
  onClose,
  onSaved,
}: {
  title: string;
  hospitalId: string;
  department?: Department;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<DeptValues>({
    resolver: zodResolver(deptSchema),
    defaultValues: { name: department?.name ?? "" },
  });

  const onSubmit = async (values: DeptValues) => {
    setServerError(null);
    try {
      if (department) await hospitalsApi.updateDepartment(hospitalId, department.id, values.name);
      else await hospitalsApi.createDepartment(hospitalId, values.name);
      onSaved();
    } catch (err: any) {
      setServerError(err?.message ?? "Failed to save department");
    }
  };

  return (
    <Modal title={title} onClose={onClose}>
      {serverError && <Alert>{serverError}</Alert>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field label="Department name" error={errors.name?.message} {...register("name")} />
        <PrimaryButton type="submit" isLoading={isSubmitting}>Save</PrimaryButton>
      </form>
    </Modal>
  );
}