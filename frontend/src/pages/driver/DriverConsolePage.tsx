import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { tripsApi, AmbulanceTrip, TripStatus } from "../../api/trips.api";
import { ambulancesApi } from "../../api/ambulances.api";
import { useAuth } from "../../context/AuthContext";
import RouteMap from "../../components/RouteMap";

const ACTIVE_STATUSES: TripStatus[] = ["ASSIGNED", "EN_ROUTE_TO_PICKUP", "ARRIVED_AT_PICKUP", "EN_ROUTE_TO_HOSPITAL"];

const NEXT_ACTION: Partial<Record<TripStatus, { next: TripStatus; label: string }>> = {
  ASSIGNED: { next: "EN_ROUTE_TO_PICKUP", label: "Start driving to pickup" },
  EN_ROUTE_TO_PICKUP: { next: "ARRIVED_AT_PICKUP", label: "Arrived at pickup" },
  ARRIVED_AT_PICKUP: { next: "EN_ROUTE_TO_HOSPITAL", label: "Patient onboard — depart for hospital" },
  EN_ROUTE_TO_HOSPITAL: { next: "COMPLETED", label: "Mark trip complete" },
};

const STAGE_LABEL: Record<TripStatus, string> = {
  ASSIGNED: "Dispatched — awaiting departure",
  EN_ROUTE_TO_PICKUP: "En route to pickup",
  ARRIVED_AT_PICKUP: "Arrived at pickup",
  EN_ROUTE_TO_HOSPITAL: "En route to hospital",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

// Even if the browser reports position more often, only push to the server
// this often — plenty for a live map, much friendlier to battery/data/API.
const MIN_PING_INTERVAL_MS = 6000;

function fullName(p: { firstName: string; lastName: string }) {
  return `${p.firstName} ${p.lastName}`;
}

export default function DriverConsolePage() {
  const { user, logout } = useAuth();
  const [trip, setTrip] = useState<AmbulanceTrip | null | undefined>(undefined); // undefined = loading
  const [error, setError] = useState<string | null>(null);
  const [gpsStatus, setGpsStatus] = useState<"idle" | "active" | "denied" | "unsupported">("idle");
  const [isUpdating, setIsUpdating] = useState(false);
  const lastPingRef = useRef(0);
  const watchIdRef = useRef<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadTrip = async () => {
    try {
      const res = await tripsApi.list({});
      const active = (res.data ?? []).find((t) => ACTIVE_STATUSES.includes(t.status));
      setTrip(active ?? null);
      setError(null);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load your trip");
      setTrip(null);
    }
  };

  useEffect(() => {
    loadTrip();
    pollRef.current = setInterval(loadTrip, 8000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Stream live GPS to the backend for as long as there's an active trip.
  useEffect(() => {
    if (!trip) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setGpsStatus("idle");
      return;
    }

    if (!("geolocation" in navigator)) {
      setGpsStatus("unsupported");
      return;
    }

    const ambulanceId = trip.ambulance.id;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setGpsStatus("active");
        const now = Date.now();
        if (now - lastPingRef.current < MIN_PING_INTERVAL_MS) return;
        lastPingRef.current = now;

        const { latitude, longitude, speed, heading } = position.coords;
        ambulancesApi
          .recordLocation(ambulanceId, {
            lat: latitude,
            lng: longitude,
            speedKph: speed != null ? Math.round(speed * 3.6) : undefined,
            headingDeg: heading ?? undefined,
          })
          .catch(() => {
            /* transient network errors shouldn't interrupt the watch */
          });
      },
      () => setGpsStatus("denied"),
      { enableHighAccuracy: true, maximumAge: 4000, timeout: 15000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip?.id]);

  const handleAdvance = async () => {
    if (!trip) return;
    const action = NEXT_ACTION[trip.status];
    if (!action) return;
    setIsUpdating(true);
    try {
      await tripsApi.updateStatus(trip.id, action.next as Exclude<TripStatus, "ASSIGNED">);
      await loadTrip();
    } catch (err: any) {
      alert(err?.message ?? "Failed to update trip status");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = async () => {
    if (!trip || !confirm("Cancel this trip?")) return;
    setIsUpdating(true);
    try {
      await tripsApi.updateStatus(trip.id, "CANCELLED");
      await loadTrip();
    } catch (err: any) {
      alert(err?.message ?? "Failed to cancel trip");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <header className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{user ? fullName(user) : "Driver"}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">Driver console</p>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/driver/emergency" className="text-sm font-medium text-red-600 hover:underline">
            🚨 Emergency
          </Link>
          <button onClick={logout} className="text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-red-600">
            Log out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-lg p-4">
        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {trip === undefined ? (
          <div className="py-16 text-center text-sm text-slate-400 dark:text-slate-500">Loading...</div>
        ) : trip === null ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 text-center">
            <p className="text-4xl">🚑</p>
            <p className="mt-3 font-medium text-slate-700 dark:text-slate-200">No active trip right now</p>
            <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">You'll see it here the moment dispatch assigns you one.</p>
          </div>
        ) : (
          <>
            <div className="mb-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {trip.ambulance.vehicleNumber}
                </p>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    gpsStatus === "active"
                      ? "bg-emerald-100 text-emerald-700"
                      : gpsStatus === "denied" || gpsStatus === "unsupported"
                        ? "bg-red-100 text-red-700"
                        : "bg-slate-100 text-slate-500"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${gpsStatus === "active" ? "bg-emerald-500" : "bg-slate-400"}`} />
                  {gpsStatus === "active" ? "GPS live" : gpsStatus === "denied" ? "Location denied" : gpsStatus === "unsupported" ? "No GPS" : "Connecting..."}
                </span>
              </div>
              <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">{STAGE_LABEL[trip.status]}</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Patient: {fullName(trip.transfer.patient.user)}
              </p>
            </div>

            {gpsStatus === "denied" && (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Location access is blocked. Enable it for this site in your browser settings so dispatch and the receiving
                hospital can see your live position.
              </div>
            )}

            <div className="mb-4 space-y-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Pickup</p>
                <p className="text-sm text-slate-700 dark:text-slate-200">{trip.pickupAddress ?? "See map"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Destination</p>
                <p className="text-sm text-slate-700 dark:text-slate-200">{trip.destinationLabel}</p>
              </div>
              {trip.etaSeconds != null && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">ETA</p>
                  <p className="text-sm text-slate-700 dark:text-slate-200">{Math.round(trip.etaSeconds / 60)} min</p>
                </div>
              )}
            </div>

            <div className="mb-4">
              <RouteMap
                pickup={{ lat: trip.pickupLat, lng: trip.pickupLng, label: "Pickup" }}
                destination={{ lat: trip.destinationLat, lng: trip.destinationLng, label: trip.destinationLabel ?? "Destination" }}
                ambulance={
                  trip.ambulance.currentLat != null && trip.ambulance.currentLng != null
                    ? { lat: trip.ambulance.currentLat, lng: trip.ambulance.currentLng, label: "You" }
                    : null
                }
                routeGeometry={trip.routeGeometry}
                height="260px"
              />
            </div>

            {NEXT_ACTION[trip.status] && (
              <button
                onClick={handleAdvance}
                disabled={isUpdating}
                className="mb-3 w-full rounded-xl bg-brand-600 py-4 text-base font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
              >
                {isUpdating ? "Updating..." : NEXT_ACTION[trip.status]!.label}
              </button>
            )}
            <button
              onClick={handleCancel}
              disabled={isUpdating}
              className="w-full rounded-xl border border-red-300 py-3 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
            >
              Cancel trip
            </button>
          </>
        )}
      </main>
    </div>
  );
}
