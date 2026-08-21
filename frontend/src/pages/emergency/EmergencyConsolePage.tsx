import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { emergencyApi, EmergencyCase, VitalsReading } from "../../api/emergency.api";
import { ambulancesApi, Ambulance } from "../../api/ambulances.api";
import { hospitalsApi, Hospital } from "../../api/hospitals.api";
import { usersApi, UserListItem } from "../../api/users.api";
import { useAuth } from "../../context/AuthContext";
import { publishMqtt, isMqttConfigured } from "../../lib/mqttClient";
import VitalsMonitor from "../../components/VitalsMonitor";

const ACTIVE_STATUSES = ["MONITORING", "DISPATCHED", "ACKNOWLEDGED", "ASSIGNED"];
const MONITOR_TICK_MS = 2000;
const SNAPSHOT_PUSH_MS = 8000;
const ABNORMAL_DURATION_MS = 15000;
const GPS_MIN_PUSH_INTERVAL_MS = 6000;

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function fullName(p: { firstName: string; lastName: string }) {
  return `${p.firstName} ${p.lastName}`;
}

function nextVitals(prev: VitalsReading, forceAbnormal: boolean): VitalsReading {
  if (forceAbnormal) {
    const spikeType = Math.random() < 0.5 ? "hr" : "spo2";
    return {
      heartRate:
        spikeType === "hr"
          ? Math.round(170 + Math.random() * 25)
          : Math.round(clamp((prev.heartRate ?? 78) + (Math.random() - 0.5) * 6, 50, 140)),
      spo2:
        spikeType === "spo2"
          ? Math.round(75 + Math.random() * 10)
          : Math.round(clamp((prev.spo2 ?? 97) + (Math.random() - 0.5) * 2, 92, 99)),
      systolic: Math.round(clamp((prev.systolic ?? 120) + (Math.random() - 0.5) * 12, 85, 170)),
      diastolic: Math.round(clamp((prev.diastolic ?? 80) + (Math.random() - 0.5) * 8, 50, 105)),
      respRate: Math.round(clamp((prev.respRate ?? 16) + (Math.random() - 0.5) * 4, 8, 32)),
      tempC: +clamp((prev.tempC ?? 37) + (Math.random() - 0.5) * 0.4, 35, 39.5).toFixed(1),
      markAbnormal: true,
    };
  }
  return {
    heartRate: Math.round(clamp((prev.heartRate ?? 78) + (Math.random() - 0.5) * 8 + (78 - (prev.heartRate ?? 78)) * 0.08, 55, 110)),
    spo2: Math.round(clamp((prev.spo2 ?? 97) + (Math.random() - 0.5) * 2, 94, 100)),
    systolic: Math.round(clamp((prev.systolic ?? 120) + (Math.random() - 0.5) * 6, 100, 140)),
    diastolic: Math.round(clamp((prev.diastolic ?? 80) + (Math.random() - 0.5) * 5, 65, 95)),
    respRate: Math.round(clamp((prev.respRate ?? 16) + (Math.random() - 0.5) * 3, 12, 22)),
    tempC: +clamp((prev.tempC ?? 37) + (Math.random() - 0.5) * 0.2, 36.2, 37.8).toFixed(1),
    markAbnormal: false,
  };
}

/** Human-readable reason for a GeolocationPositionError, incl. the #1 silent-fail cause: insecure origin. */
function describeGeoError(err: GeolocationPositionError): string {
  if (err.code === err.PERMISSION_DENIED) {
    return "Location access is blocked. Enable it for this site in your browser settings, then try again.";
  }
  if (err.code === err.TIMEOUT) {
    return "Getting your location timed out — try again, ideally with a clear view of the sky, or enter coordinates manually below.";
  }
  return "Couldn't determine your location — enter coordinates manually below.";
}

export default function EmergencyConsolePage() {
  const { user } = useAuth();
  const [emergencyCase, setEmergencyCase] = useState<EmergencyCase | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadCase = async () => {
    try {
      const res = await emergencyApi.list({});
      const active = (res.data ?? []).find((c) => ACTIVE_STATUSES.includes(c.status));
      setEmergencyCase(active ?? null);
      setError(null);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load emergency case");
      setEmergencyCase(null);
    }
  };

  useEffect(() => {
    loadCase();
    pollRef.current = setInterval(loadCase, 6000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <header className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{user ? fullName(user) : "Paramedic"}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">Emergency response</p>
        </div>
        <Link to="/driver" className="text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-brand-600">
          Scheduled trip
        </Link>
      </header>

      <main className="mx-auto max-w-lg p-4">
        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {!window.isSecureContext && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            This page isn't loaded over HTTPS (or localhost) — browsers block GPS location on insecure connections. Ask
            whoever's hosting this to serve it over HTTPS, or use manual coordinates below.
          </div>
        )}
        {!isMqttConfigured && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            MQTT isn't configured (VITE_MQTT_URL) — the live monitor will still record snapshots, but won't stream in real time.
          </div>
        )}

        {emergencyCase === undefined ? (
          <div className="py-16 text-center text-sm text-slate-400 dark:text-slate-500">Loading...</div>
        ) : emergencyCase === null ? (
          <StartCaseForm onStarted={loadCase} />
        ) : (
          <ActiveCasePanel emergencyCase={emergencyCase} onChanged={loadCase} />
        )}
      </main>
    </div>
  );
}

function StartCaseForm({ onStarted }: { onStarted: () => void }) {
  const [myAmbulance, setMyAmbulance] = useState<Ambulance | null | undefined>(undefined);
  const [patientMode, setPatientMode] = useState<"unknown" | "registered">("unknown");
  const [unknownLabel, setUnknownLabel] = useState("");
  const [patientSearch, setPatientSearch] = useState("");
  const [patientResults, setPatientResults] = useState<UserListItem[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<UserListItem | null>(null);
  const [pickupLat, setPickupLat] = useState<number | null>(null);
  const [pickupLng, setPickupLng] = useState<number | null>(null);
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    ambulancesApi
      .getMine()
      .then((res) => setMyAmbulance(res.data ?? null))
      .catch(() => setMyAmbulance(null));
  }, []);

  useEffect(() => {
    if (patientMode !== "registered" || patientSearch.trim().length < 2) {
      setPatientResults([]);
      return;
    }
    const handle = setTimeout(() => {
      usersApi
        .list({ roleCode: "PATIENT", search: patientSearch.trim(), pageSize: 8 })
        .then((res) => setPatientResults(res.data?.items ?? []))
        .catch((err) => setError(err?.message ?? "Failed to search patients"));
    }, 300);
    return () => clearTimeout(handle);
  }, [patientMode, patientSearch]);

  const handleUseGps = (highAccuracy = true) => {
    if (!("geolocation" in navigator)) {
      setError("Your browser doesn't support GPS location — enter coordinates manually below.");
      return;
    }
    setError(null);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPickupLat(pos.coords.latitude);
        setPickupLng(pos.coords.longitude);
        setLocating(false);
      },
      (err) => {
        if (highAccuracy && err.code === err.TIMEOUT) {
          handleUseGps(false);
          return;
        }
        setError(describeGeoError(err));
        setLocating(false);
      },
      { enableHighAccuracy: highAccuracy, timeout: highAccuracy ? 10000 : 15000, maximumAge: 0 }
    );
  };

  const handleApplyManualCoords = () => {
    const lat = Number(manualLat);
    const lng = Number(manualLng);
    if (Number.isNaN(lat) || lat < -90 || lat > 90 || Number.isNaN(lng) || lng < -180 || lng > 180) {
      setError("Enter valid coordinates (latitude -90 to 90, longitude -180 to 180)");
      return;
    }
    setPickupLat(lat);
    setPickupLng(lng);
    setError(null);
  };

  const canSubmit =
    !!myAmbulance &&
    myAmbulance.status === "AVAILABLE" &&
    pickupLat != null &&
    pickupLng != null &&
    (patientMode === "unknown" ? unknownLabel.trim().length > 1 : !!selectedPatient);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await emergencyApi.start({
        patientUserId: patientMode === "registered" ? selectedPatient!.id : undefined,
        unknownPatientLabel: patientMode === "unknown" ? unknownLabel.trim() : undefined,
        pickupLat: pickupLat!,
        pickupLng: pickupLng!,
        pickupAddress: pickupAddress.trim() || undefined,
      });
      onStarted();
    } catch (err: any) {
      setError(err?.message ?? "Failed to start emergency case");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (myAmbulance === undefined) {
    return <div className="py-16 text-center text-sm text-slate-400 dark:text-slate-500">Loading...</div>;
  }

  if (myAmbulance === null) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-center">
        <p className="text-3xl">🚑</p>
        <p className="mt-3 font-medium text-amber-800">No ambulance is assigned to you yet</p>
        <p className="mt-1 text-sm text-amber-700">Ask an admin to assign you a vehicle on the Ambulances page, then come back here.</p>
      </div>
    );
  }

  if (myAmbulance.status !== "AVAILABLE") {
    return (
      <div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 text-center">
        <p className="text-3xl">🚑</p>
        <p className="mt-3 font-medium text-slate-700 dark:text-slate-200">{myAmbulance.vehicleNumber} isn't available right now</p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Status: {myAmbulance.status.replaceAll("_", " ").toLowerCase()}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
      <p className="mb-1 text-lg font-semibold text-slate-800 dark:text-slate-100">🚨 Start emergency pickup</p>
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        Vehicle <span className="font-semibold text-slate-700 dark:text-slate-200">{myAmbulance.vehicleNumber}</span> · Connect
        the PPG monitor and begin live tracking.
      </p>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Patient</label>
        <div className="mb-2 flex gap-2">
          <button
            onClick={() => setPatientMode("unknown")}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
              patientMode === "unknown" ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300"
            }`}
          >
            Unidentified
          </button>
          <button
            onClick={() => setPatientMode("registered")}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
              patientMode === "registered" ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300"
            }`}
          >
            Registered patient
          </button>
        </div>

        {patientMode === "unknown" ? (
          <input
            type="text"
            value={unknownLabel}
            onChange={(e) => setUnknownLabel(e.target.value)}
            placeholder="e.g. Unidentified male, approx. 40s"
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
          />
        ) : selectedPatient ? (
          <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm">
            <span>{fullName(selectedPatient)}</span>
            <button onClick={() => setSelectedPatient(null)} className="text-xs text-brand-600 hover:underline">
              Change
            </button>
          </div>
        ) : (
          <>
            <input
              type="text"
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
            />
            {patientResults.length > 0 && (
              <ul className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
                {patientResults.map((p) => (
                  <li
                    key={p.id}
                    onClick={() => setSelectedPatient(p)}
                    className="cursor-pointer px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    {fullName(p)} <span className="text-slate-400">({p.email})</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Pickup location</label>
        <button
          onClick={() => handleUseGps(true)}
          disabled={locating}
          className="mb-2 w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-60"
        >
          {locating
            ? "Getting location..."
            : pickupLat != null
              ? `📍 ${pickupLat.toFixed(5)}, ${pickupLng!.toFixed(5)} (tap to refresh)`
              : "📍 Use my current GPS location"}
        </button>

        <details className="mb-2 text-sm">
          <summary className="cursor-pointer text-slate-500 dark:text-slate-400">GPS not working? Enter coordinates manually</summary>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <input
              type="number"
              step="any"
              value={manualLat}
              onChange={(e) => setManualLat(e.target.value)}
              placeholder="Latitude"
              className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
            />
            <input
              type="number"
              step="any"
              value={manualLng}
              onChange={(e) => setManualLng(e.target.value)}
              placeholder="Longitude"
              className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
            />
          </div>
          <button
            onClick={handleApplyManualCoords}
            className="mt-2 w-full rounded-lg bg-slate-800 py-2 text-sm font-medium text-white hover:bg-slate-900"
          >
            Use these coordinates
          </button>
        </details>

        <input
          type="text"
          value={pickupAddress}
          onChange={(e) => setPickupAddress(e.target.value)}
          placeholder="Landmark / address note (optional)"
          className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={!canSubmit || isSubmitting}
        className="w-full rounded-xl bg-red-600 py-4 text-base font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
      >
        {isSubmitting ? "Starting..." : "🚨 Start monitoring"}
      </button>
    </div>
  );
}

function ActiveCasePanel({ emergencyCase, onChanged }: { emergencyCase: EmergencyCase; onChanged: () => void }) {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState("");
  const [isDispatching, setIsDispatching] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gpsStatus, setGpsStatus] = useState<"idle" | "active" | "denied" | "unsupported">("idle");

  const lastVitalsRef = useRef<VitalsReading>({});
  const forcedAbnormalUntilRef = useRef<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSnapshotPushRef = useRef(0);
  const lastGpsPushRef = useRef(0);
  const watchIdRef = useRef<number | null>(null);

  const isMonitoringOnwards = ["MONITORING", "DISPATCHED", "ACKNOWLEDGED", "ASSIGNED"].includes(emergencyCase.status);

  useEffect(() => {
    if (emergencyCase.status === "MONITORING") {
      hospitalsApi
        .list({ isActive: "true", pageSize: 100 })
        .then((res) => setHospitals(res.data?.items ?? []))
        .catch((err) => setError(err?.message ?? "Failed to load hospitals"));
    }
  }, [emergencyCase.status]);

  useEffect(() => {
    if (!isMonitoringOnwards) return;
    tickRef.current = setInterval(() => {
      const forceAbnormal = Date.now() < forcedAbnormalUntilRef.current;
      const reading = nextVitals(lastVitalsRef.current, forceAbnormal);
      lastVitalsRef.current = reading;
      publishMqtt(emergencyCase.mqttTopic, reading);

      if (Date.now() - lastSnapshotPushRef.current > SNAPSHOT_PUSH_MS) {
        lastSnapshotPushRef.current = Date.now();
        emergencyApi.recordVitals(emergencyCase.id, reading).catch(() => {});
      }
    }, MONITOR_TICK_MS);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMonitoringOnwards, emergencyCase.id, emergencyCase.mqttTopic]);

  // Live GPS for the ambulance itself, same throttled watchPosition pattern
  // as the scheduled-trip driver console — this moves the ambulance marker
  // on the admin/doctor's live map while the case is active. This is new:
  // previously the emergency console never streamed continuous location at
  // all, only a one-time pickup point.
  useEffect(() => {
    if (!isMonitoringOnwards) {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      setGpsStatus("idle");
      return;
    }
    if (!("geolocation" in navigator)) {
      setGpsStatus("unsupported");
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setGpsStatus("active");
        const now = Date.now();
        if (now - lastGpsPushRef.current < GPS_MIN_PUSH_INTERVAL_MS) return;
        lastGpsPushRef.current = now;
        const { latitude, longitude, speed, heading } = position.coords;
        ambulancesApi
          .recordLocation(emergencyCase.ambulance.id, {
            lat: latitude,
            lng: longitude,
            speedKph: speed != null ? Math.round(speed * 3.6) : undefined,
            headingDeg: heading ?? undefined,
          })
          .catch(() => {});
      },
      () => setGpsStatus("denied"),
      { enableHighAccuracy: true, maximumAge: 4000, timeout: 15000 }
    );

    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMonitoringOnwards, emergencyCase.ambulance.id]);

  const handleTriggerAbnormal = () => {
    forcedAbnormalUntilRef.current = Date.now() + ABNORMAL_DURATION_MS;
  };

  const handleAutoNearest = async () => {
    setIsDispatching(true);
    setError(null);
    try {
      await emergencyApi.selectHospital(emergencyCase.id);
      onChanged();
    } catch (err: any) {
      setError(err?.message ?? "Failed to select hospital");
    } finally {
      setIsDispatching(false);
    }
  };

  const handleManualSelect = async () => {
    if (!selectedHospitalId) return;
    setIsDispatching(true);
    setError(null);
    try {
      await emergencyApi.selectHospital(emergencyCase.id, selectedHospitalId);
      onChanged();
    } catch (err: any) {
      setError(err?.message ?? "Failed to select hospital");
    } finally {
      setIsDispatching(false);
    }
  };

  const handleArrived = async () => {
    setIsUpdating(true);
    try {
      await emergencyApi.markArrived(emergencyCase.id);
      onChanged();
    } catch (err: any) {
      alert(err?.message ?? "Failed to mark arrived");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Cancel this emergency case?")) return;
    setIsUpdating(true);
    try {
      await emergencyApi.cancel(emergencyCase.id);
      onChanged();
    } catch (err: any) {
      alert(err?.message ?? "Failed to cancel case");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div>
      <div className="mb-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{emergencyCase.ambulance.vehicleNumber}</p>
          {isMonitoringOnwards && (
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
          )}
        </div>
        <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          {emergencyCase.patient ? fullName(emergencyCase.patient.user) : emergencyCase.unknownPatientLabel}
        </p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Status: {emergencyCase.status.replaceAll("_", " ").toLowerCase()}
          {emergencyCase.hospital && ` · Destination: ${emergencyCase.hospital.name}`}
        </p>
      </div>

      {gpsStatus === "denied" && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Location access is blocked, so the ambulance's live position won't update on the map. Enable it for this site in
          your browser settings.
        </div>
      )}

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="mb-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
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
        {isMonitoringOnwards && (
          <button
            onClick={handleTriggerAbnormal}
            className="mt-4 w-full rounded-lg border border-red-300 bg-red-50 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100"
          >
            ⚠ Trigger abnormal reading
          </button>
        )}
      </div>

      {emergencyCase.status === "MONITORING" && (
        <div className="mb-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
          <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Choose destination hospital</p>
          <button
            onClick={handleAutoNearest}
            disabled={isDispatching}
            className="mb-3 w-full rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {isDispatching ? "Finding nearest hospital..." : "🧭 Auto-select nearest hospital"}
          </button>
          <div className="flex gap-2">
            <select
              value={selectedHospitalId}
              onChange={(e) => setSelectedHospitalId(e.target.value)}
              className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
            >
              <option value="">Or choose manually...</option>
              {hospitals.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleManualSelect}
              disabled={!selectedHospitalId || isDispatching}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {["DISPATCHED", "ACKNOWLEDGED", "ASSIGNED"].includes(emergencyCase.status) && (
          <button
            onClick={handleArrived}
            disabled={isUpdating}
            className="w-full rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            Arrived at hospital
          </button>
        )}
        {emergencyCase.status !== "ARRIVED" && (
          <button
            onClick={handleCancel}
            disabled={isUpdating}
            className="w-full rounded-xl border border-red-300 py-3 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
          >
            Cancel case
          </button>
        )}
      </div>
    </div>
  );
}
