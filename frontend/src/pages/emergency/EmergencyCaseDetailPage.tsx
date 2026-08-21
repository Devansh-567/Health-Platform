import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { emergencyApi, EmergencyCase } from "../../api/emergency.api";
import { usersApi, UserListItem } from "../../api/users.api";
import { useAuth } from "../../context/AuthContext";
import { PERMISSIONS } from "../../constants/permissions";
import { PageHeader, StatusBadge } from "../../components/UiPrimitives";
import { Alert } from "../../components/FormControls";
import VitalsMonitor from "../../components/VitalsMonitor";
import RouteMap from "../../components/RouteMap";

const POLL_MS = 5000;

function fullName(p: { firstName: string; lastName: string }) {
  return `${p.firstName} ${p.lastName}`;
}

export default function EmergencyCaseDetailPage() {
  const { caseId = "" } = useParams();
  const { hasPermission } = useAuth();
  const canTriage = hasPermission(PERMISSIONS.EMERGENCY_CASE_TRIAGE);

  const [emergencyCase, setEmergencyCase] = useState<EmergencyCase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [doctors, setDoctors] = useState<UserListItem[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [isActing, setIsActing] = useState(false);

  const load = async () => {
    try {
      const res = await emergencyApi.get(caseId);
      setEmergencyCase(res.data ?? null);
      setError(null);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load case");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  useEffect(() => {
    if (canTriage && emergencyCase?.hospital) {
      usersApi.list({ roleCode: "DOCTOR", hospitalId: emergencyCase.hospital.id, pageSize: 50 }).then((res) => setDoctors(res.data?.items ?? []));
    }
  }, [canTriage, emergencyCase?.hospital]);

  const handleAcknowledge = async () => {
    if (!emergencyCase) return;
    setIsActing(true);
    try {
      await emergencyApi.acknowledge(emergencyCase.id);
      load();
    } catch (err: any) {
      alert(err?.message ?? "Failed to acknowledge");
    } finally {
      setIsActing(false);
    }
  };

  const handleAssign = async () => {
    if (!emergencyCase || !selectedDoctorId) return;
    setIsActing(true);
    try {
      await emergencyApi.assignDoctor(emergencyCase.id, selectedDoctorId);
      load();
    } catch (err: any) {
      alert(err?.message ?? "Failed to assign doctor");
    } finally {
      setIsActing(false);
    }
  };

  const handleArrived = async () => {
    if (!emergencyCase) return;
    setIsActing(true);
    try {
      await emergencyApi.markArrived(emergencyCase.id);
      load();
    } catch (err: any) {
      alert(err?.message ?? "Failed to mark arrived");
    } finally {
      setIsActing(false);
    }
  };

  const handleClose = async () => {
    if (!emergencyCase) return;
    setIsActing(true);
    try {
      await emergencyApi.close(emergencyCase.id);
      load();
    } catch (err: any) {
      alert(err?.message ?? "Failed to close case");
    } finally {
      setIsActing(false);
    }
  };

  const handleCancel = async () => {
    if (!emergencyCase || !confirm("Cancel this emergency case?")) return;
    setIsActing(true);
    try {
      await emergencyApi.cancel(emergencyCase.id);
      load();
    } catch (err: any) {
      alert(err?.message ?? "Failed to cancel case");
    } finally {
      setIsActing(false);
    }
  };

  if (isLoading) return <div className="p-8 text-sm text-slate-400 dark:text-slate-500">Loading...</div>;
  if (error || !emergencyCase)
    return (
      <div className="p-8">
        <Alert>{error ?? "Case not found"}</Alert>
      </div>
    );

  const patientLabel = emergencyCase.patient ? fullName(emergencyCase.patient.user) : emergencyCase.unknownPatientLabel ?? "Unidentified patient";

  return (
    <div className="p-8">
      <PageHeader
        title={patientLabel}
        subtitle={`${emergencyCase.ambulance.vehicleNumber} · Paramedic ${fullName(emergencyCase.paramedic)}${emergencyCase.hospital ? ` · ${emergencyCase.hospital.name}` : ""}`}
        action={<StatusBadge value={emergencyCase.status} />}
      />

      {emergencyCase.status === "DISPATCHED" && canTriage && (
        <div className="mb-6 flex items-center justify-between rounded-xl border border-red-300 bg-red-50 px-5 py-4 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm font-medium text-red-700 dark:text-red-400">This alarm hasn't been acknowledged yet.</p>
          <button
            onClick={handleAcknowledge}
            disabled={isActing}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            Acknowledge
          </button>
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
          <VitalsMonitor
            mqttTopic={emergencyCase.mqttTopic}
            fallback={{
              heartRate: emergencyCase.latestHeartRate,
              spo2: emergencyCase.latestSpo2,
              systolic: emergencyCase.latestSystolic,
              diastolic: emergencyCase.latestDiastolic,
              respRate: emergencyCase.latestRespRate,
              tempC: emergencyCase.latestTempC,
              isAbnormal: emergencyCase.isAbnormal,
              readingAt: emergencyCase.latestReadingAt,
            }}
          />
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Case details</p>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Pickup</dt>
              <dd className="text-slate-800 dark:text-slate-100">{emergencyCase.pickupAddress ?? "See map"}</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Destination</dt>
              <dd className="text-slate-800 dark:text-slate-100">{emergencyCase.hospital?.name ?? "Not yet selected"}</dd>
            </div>
            {emergencyCase.selectionMethod && (
              <div>
                <dt className="text-slate-500 dark:text-slate-400">Selection method</dt>
                <dd className="text-slate-800 dark:text-slate-100">
                  {emergencyCase.selectionMethod === "AUTO_NEAREST" ? "Auto-selected (nearest by drive time)" : "Manually selected"}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Assigned doctor</dt>
              <dd className="text-slate-800 dark:text-slate-100">
                {emergencyCase.assignedDoctor ? fullName(emergencyCase.assignedDoctor) : "Not yet assigned"}
              </dd>
            </div>
          </dl>

          {canTriage && ["DISPATCHED", "ACKNOWLEDGED"].includes(emergencyCase.status) && (
            <div className="mt-4 border-t border-slate-200 dark:border-slate-700 pt-4">
              <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Assign a doctor</p>
              <select
                value={selectedDoctorId}
                onChange={(e) => setSelectedDoctorId(e.target.value)}
                className="mb-2 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
              >
                <option value="">Select a doctor...</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {fullName(d)}
                  </option>
                ))}
              </select>
              <button
                onClick={handleAssign}
                disabled={!selectedDoctorId || isActing}
                className="w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                Assign doctor
              </button>
            </div>
          )}

          {canTriage && !["ARRIVED", "CLOSED", "CANCELLED"].includes(emergencyCase.status) && (
            <div className="mt-4 flex gap-2 border-t border-slate-200 dark:border-slate-700 pt-4">
              {["DISPATCHED", "ACKNOWLEDGED", "ASSIGNED"].includes(emergencyCase.status) && (
                <button
                  onClick={handleArrived}
                  disabled={isActing}
                  className="flex-1 rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  Mark arrived
                </button>
              )}
              <button
                onClick={handleCancel}
                disabled={isActing}
                className="flex-1 rounded-lg border border-red-300 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          )}

          {canTriage && emergencyCase.status === "ARRIVED" && (
            <button
              onClick={handleClose}
              disabled={isActing}
              className="mt-4 w-full rounded-lg bg-slate-800 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-60"
            >
              Close case
            </button>
          )}
        </div>
      </div>

      {emergencyCase.hospital && (
        <RouteMap
          pickup={{ lat: emergencyCase.pickupLat, lng: emergencyCase.pickupLng, label: emergencyCase.pickupAddress ?? "Pickup" }}
          destination={{ lat: emergencyCase.hospital.latitude!, lng: emergencyCase.hospital.longitude!, label: emergencyCase.hospital.name }}
          ambulance={
            emergencyCase.ambulance.currentLat != null && emergencyCase.ambulance.currentLng != null
              ? { lat: emergencyCase.ambulance.currentLat, lng: emergencyCase.ambulance.currentLng, label: emergencyCase.ambulance.vehicleNumber }
              : null
          }
        />
      )}
    </div>
  );
}
