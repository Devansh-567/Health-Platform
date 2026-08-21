import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { tripsApi, AmbulanceTrip, TripStatus } from "../../api/trips.api";
import { useAuth } from "../../context/AuthContext";
import { PERMISSIONS } from "../../constants/permissions";
import { PageHeader, StatusBadge } from "../../components/UiPrimitives";
import { Alert } from "../../components/FormControls";
import RouteMap from "../../components/RouteMap";

const POLL_INTERVAL_MS = 5000;

const STAGES: { status: TripStatus; label: string }[] = [
  { status: "ASSIGNED", label: "Dispatched" },
  { status: "EN_ROUTE_TO_PICKUP", label: "En route to pickup" },
  { status: "ARRIVED_AT_PICKUP", label: "Arrived at pickup" },
  { status: "EN_ROUTE_TO_HOSPITAL", label: "En route to hospital" },
  { status: "COMPLETED", label: "Completed" },
];

function formatDuration(seconds: number | null) {
  if (seconds == null) return "—";
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function formatDistance(meters: number | null) {
  if (meters == null) return "—";
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

function fullName(p: { firstName: string; lastName: string }) {
  return `${p.firstName} ${p.lastName}`;
}

export default function TripTrackingPage() {
  const { tripId = "" } = useParams();
  const { hasPermission } = useAuth();
  const [trip, setTrip] = useState<AmbulanceTrip | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    try {
      const res = await tripsApi.get(tripId);
      setTrip(res.data ?? null);
      setError(null);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load trip");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  const handleCancel = async () => {
    if (!trip || !confirm("Cancel this ambulance trip? The ambulance will be freed up.")) return;
    try {
      await tripsApi.updateStatus(trip.id, "CANCELLED");
      load();
    } catch (err: any) {
      alert(err?.message ?? "Failed to cancel trip");
    }
  };

  if (isLoading) return <div className="p-8 text-sm text-slate-400 dark:text-slate-500">Loading trip...</div>;
  if (error || !trip) return <div className="p-8"><Alert>{error ?? "Trip not found"}</Alert></div>;

  const isActive = !["COMPLETED", "CANCELLED"].includes(trip.status);
  const currentStageIndex = STAGES.findIndex((s) => s.status === trip.status);
  const canCancel = isActive && hasPermission(PERMISSIONS.AMBULANCE_TRIP_MANAGE);

  const ambulancePoint =
    trip.ambulance.currentLat != null && trip.ambulance.currentLng != null
      ? { lat: trip.ambulance.currentLat, lng: trip.ambulance.currentLng, label: `${trip.ambulance.vehicleNumber} (live)` }
      : null;

  const pingTrail: [number, number][] = (trip.pings ?? []).map((p) => [p.lat, p.lng]);

  return (
    <div className="p-8">
      <PageHeader
        title={`Transport for ${fullName(trip.transfer.patient.user)}`}
        subtitle={`${trip.transfer.fromHospital.name} → ${trip.transfer.toHospital.name} · Vehicle ${trip.ambulance.vehicleNumber}`}
        action={
          <div className="flex items-center gap-3">
            <StatusBadge value={trip.status} />
            {canCancel && (
              <button onClick={handleCancel} className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                Cancel trip
              </button>
            )}
          </div>
        }
      />

      {trip.status === "CANCELLED" && <Alert>This trip was cancelled.</Alert>}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">ETA</p>
          <p className="mt-1 text-lg font-semibold text-slate-800 dark:text-slate-100">{formatDuration(trip.etaSeconds)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Distance</p>
          <p className="mt-1 text-lg font-semibold text-slate-800 dark:text-slate-100">{formatDistance(trip.distanceMeters)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Driver</p>
          <p className="mt-1 text-lg font-semibold text-slate-800 dark:text-slate-100">{fullName(trip.driver)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Last GPS update</p>
          <p className="mt-1 text-lg font-semibold text-slate-800 dark:text-slate-100">
            {trip.ambulance.lastLocationAt ? new Date(trip.ambulance.lastLocationAt).toLocaleTimeString() : "No signal yet"}
          </p>
        </div>
      </div>

      <div className="mb-6">
        <RouteMap
          pickup={{ lat: trip.pickupLat, lng: trip.pickupLng, label: trip.pickupAddress ?? "Pickup" }}
          destination={{ lat: trip.destinationLat, lng: trip.destinationLng, label: trip.destinationLabel ?? "Destination" }}
          ambulance={ambulancePoint}
          routeGeometry={trip.routeGeometry}
          pingTrail={pingTrail}
        />
      </div>

      {trip.status !== "CANCELLED" && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Trip progress</p>
          <ol className="flex flex-wrap items-center gap-2">
            {STAGES.map((stage, i) => {
              const isDone = currentStageIndex >= 0 && i <= currentStageIndex;
              return (
                <li key={stage.status} className="flex items-center gap-2">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                      isDone ? "bg-brand-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className={`text-sm ${isDone ? "font-medium text-slate-800 dark:text-slate-100" : "text-slate-400 dark:text-slate-500"}`}>
                    {stage.label}
                  </span>
                  {i < STAGES.length - 1 && <span className="mx-2 h-px w-8 bg-slate-200 dark:bg-slate-700" />}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
