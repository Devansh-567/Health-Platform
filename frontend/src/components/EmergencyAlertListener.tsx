import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { subscribeMqtt } from "../lib/mqttClient";
import { PERMISSIONS } from "../constants/permissions";

interface AlertPayload {
  type: "EMERGENCY_CASE";
  caseId: string;
  patientLabel: string;
  ambulance: string;
  paramedic: string;
  pickupAddress: string | null;
  isAbnormal: boolean;
  dispatchedAt: string;
}

/** Short, unmistakable two-tone alarm beep — no external audio asset needed. */
function playAlarmTone() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtx();
    [880, 660].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.22);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.22 + 0.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.22);
      osc.stop(ctx.currentTime + i * 0.22 + 0.22);
    });
  } catch {
    /* audio isn't critical to the alert — the visible banner still shows */
  }
}

export default function EmergencyAlertListener() {
  const { user, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<AlertPayload[]>([]);
  const seenCaseIds = useRef<Set<string>>(new Set());

  const canTriage = hasPermission(PERMISSIONS.EMERGENCY_CASE_TRIAGE);
  // Super Admin isn't tied to one hospital, so it uses an MQTT wildcard to
  // hear every hospital's alarm; a regular Admin only subscribes to its own.
  const topic =
    user?.role === "SUPER_ADMIN" ? "hms/hospital/+/alerts" : user?.hospitalId ? `hms/hospital/${user.hospitalId}/alerts` : null;

  useEffect(() => {
    if (!canTriage || !topic) return;
    const unsubscribe = subscribeMqtt(topic, (payload: AlertPayload) => {
      if (payload.type !== "EMERGENCY_CASE" || seenCaseIds.current.has(payload.caseId)) return;
      seenCaseIds.current.add(payload.caseId);
      setAlerts((prev) => [payload, ...prev]);
      playAlarmTone();
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canTriage, topic]);

  if (alerts.length === 0) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[9999] flex flex-col items-center gap-2 p-3">
      {alerts.map((alert) => (
        <div
          key={alert.caseId}
          className="flex w-full max-w-xl items-center justify-between gap-4 rounded-xl border border-red-300 bg-red-600 px-5 py-3 text-white shadow-xl"
        >
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide">
              🚨 Incoming emergency
              {alert.isAbnormal && <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">Abnormal vitals</span>}
            </p>
            <p className="truncate text-sm">
              {alert.patientLabel} · {alert.ambulance} · Paramedic {alert.paramedic}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              onClick={() => {
                setAlerts((prev) => prev.filter((a) => a.caseId !== alert.caseId));
                navigate(`/emergency-cases/${alert.caseId}`);
              }}
              className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50"
            >
              View case
            </button>
            <button
              onClick={() => setAlerts((prev) => prev.filter((a) => a.caseId !== alert.caseId))}
              className="rounded-lg border border-white/40 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/10"
            >
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
