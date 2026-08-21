import { useEffect, useState } from "react";
import { ambulancesApi, Ambulance } from "../../api/ambulances.api";
import { usersApi, UserListItem } from "../../api/users.api";
import { useAuth } from "../../context/AuthContext";
import { PageHeader, StatusBadge } from "../../components/UiPrimitives";
import { Modal } from "../../components/Modal";
import { Alert, PrimaryButton } from "../../components/FormControls";

function fullName(p: { firstName: string; lastName: string }) {
  return `${p.firstName} ${p.lastName}`;
}

export default function AmbulancesPage() {
  const [ambulances, setAmbulances] = useState<Ambulance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [assignFor, setAssignFor] = useState<Ambulance | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await ambulancesApi.list();
      setAmbulances(res.data ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load ambulances");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSetStatus = async (a: Ambulance, status: "AVAILABLE" | "MAINTENANCE" | "OFFLINE") => {
    try {
      await ambulancesApi.setStatus(a.id, status);
      load();
    } catch (err: any) {
      alert(err?.message ?? "Failed to update status");
    }
  };

  const handleUnassignDriver = async (a: Ambulance) => {
    if (!confirm(`Unassign ${a.assignedDriver ? fullName(a.assignedDriver) : "the driver"} from ${a.vehicleNumber}?`)) return;
    try {
      await ambulancesApi.assignDriver(a.id, null);
      load();
    } catch (err: any) {
      alert(err?.message ?? "Failed to unassign driver");
    }
  };

  return (
    <div className="p-8">
      <PageHeader
        title="Ambulance Fleet"
        subtitle="Vehicles available for interhospital patient transport"
        action={
          <button
            onClick={() => setShowAdd(true)}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            + Add ambulance
          </button>
        }
      />

      {error && <Alert>{error}</Alert>}

      {isLoading ? (
        <div className="text-sm text-slate-400 dark:text-slate-500">Loading...</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3">Hospital</th>
                <th className="px-4 py-3">Driver</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last location update</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {ambulances.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-400 dark:text-slate-500">
                    No ambulances yet — add your first vehicle to start dispatching transfers.
                  </td>
                </tr>
              ) : (
                ambulances.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{a.vehicleNumber}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{a.hospital.name}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                      {a.assignedDriver ? (
                        <span className="flex items-center gap-2">
                          {fullName(a.assignedDriver)}
                          <button onClick={() => handleUnassignDriver(a)} className="text-xs text-red-600 hover:underline">
                            Unassign
                          </button>
                        </span>
                      ) : (
                        <button onClick={() => setAssignFor(a)} className="text-xs font-medium text-brand-600 hover:underline">
                          Assign driver
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge value={a.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                      {a.lastLocationAt ? new Date(a.lastLocationAt).toLocaleString() : "Never"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {a.status === "AVAILABLE" && (
                        <button
                          onClick={() => handleSetStatus(a, "MAINTENANCE")}
                          className="mr-3 text-sm font-medium text-amber-600 hover:underline"
                        >
                          Mark maintenance
                        </button>
                      )}
                      {a.status === "MAINTENANCE" && (
                        <button
                          onClick={() => handleSetStatus(a, "AVAILABLE")}
                          className="mr-3 text-sm font-medium text-brand-600 hover:underline"
                        >
                          Mark available
                        </button>
                      )}
                      {a.status !== "ON_TRIP" && a.status !== "OFFLINE" && (
                        <button
                          onClick={() => handleSetStatus(a, "OFFLINE")}
                          className="text-sm font-medium text-red-600 hover:underline"
                        >
                          Take offline
                        </button>
                      )}
                      {a.status === "OFFLINE" && (
                        <button
                          onClick={() => handleSetStatus(a, "AVAILABLE")}
                          className="text-sm font-medium text-brand-600 hover:underline"
                        >
                          Bring back online
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <AddAmbulanceModal
          onClose={() => setShowAdd(false)}
          onAdded={() => {
            setShowAdd(false);
            load();
          }}
        />
      )}

      {assignFor && (
        <AssignDriverModal
          ambulance={assignFor}
          onClose={() => setAssignFor(null)}
          onAssigned={() => {
            setAssignFor(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function AssignDriverModal({
  ambulance,
  onClose,
  onAssigned,
}: {
  ambulance: Ambulance;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [drivers, setDrivers] = useState<UserListItem[]>([]);
  const [driverId, setDriverId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    usersApi
      .list({ roleCode: "DRIVER", hospitalId: ambulance.hospital.id, pageSize: 100 })
      .then((res) => setDrivers(res.data?.items ?? []))
      .catch((err) => setError(err?.message ?? "Failed to load drivers"))
      .finally(() => setIsLoading(false));
  }, [ambulance.hospital.id]);

  const handleSubmit = async () => {
    if (!driverId) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await ambulancesApi.assignDriver(ambulance.id, driverId);
      onAssigned();
    } catch (err: any) {
      setError(err?.message ?? "Failed to assign driver");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title={`Assign driver to ${ambulance.vehicleNumber}`} onClose={onClose}>
      {error && <Alert>{error}</Alert>}
      {isLoading ? (
        <div className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">Loading drivers...</div>
      ) : drivers.length === 0 ? (
        <Alert>No drivers at {ambulance.hospital.name} yet. Invite one from the Staff page first.</Alert>
      ) : (
        <>
          <select
            value={driverId}
            onChange={(e) => setDriverId(e.target.value)}
            className="mb-4 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Select a driver...</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {fullName(d)}
              </option>
            ))}
          </select>
          <PrimaryButton type="button" onClick={handleSubmit} disabled={!driverId} isLoading={isSubmitting}>
            Assign
          </PrimaryButton>
        </>
      )}
    </Modal>
  );
}

function AddAmbulanceModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [hospitalId, setHospitalId] = useState(user?.hospitalId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!vehicleNumber.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await ambulancesApi.create({ vehicleNumber: vehicleNumber.trim(), hospitalId: hospitalId || undefined });
      onAdded();
    } catch (err: any) {
      setError(err?.message ?? "Failed to add ambulance");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title="Add ambulance" onClose={onClose}>
      {error && <Alert>{error}</Alert>}
      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Vehicle number</label>
        <input
          type="text"
          autoFocus
          value={vehicleNumber}
          onChange={(e) => setVehicleNumber(e.target.value)}
          placeholder="e.g. AMB-04"
          className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>
      {isSuperAdmin && (
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Hospital ID</label>
          <input
            type="text"
            value={hospitalId}
            onChange={(e) => setHospitalId(e.target.value)}
            placeholder="Hospital UUID"
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand-500"
          />
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Find this on the hospital's detail page.</p>
        </div>
      )}
      <PrimaryButton type="button" onClick={handleSubmit} disabled={!vehicleNumber.trim()} isLoading={isSubmitting}>
        Add ambulance
      </PrimaryButton>
    </Modal>
  );
}
