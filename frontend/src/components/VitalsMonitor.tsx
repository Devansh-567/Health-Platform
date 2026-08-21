import { useEffect, useRef, useState } from "react";
import { subscribeMqtt, isMqttConfigured } from "../lib/mqttClient";

interface VitalsPayload {
  heartRate?: number;
  spo2?: number;
  systolic?: number;
  diastolic?: number;
  respRate?: number;
  tempC?: number;
  isAbnormal?: boolean;
}

interface VitalsMonitorProps {
  mqttTopic: string;
  fallback: {
    heartRate: number | null;
    spo2: number | null;
    systolic: number | null;
    diastolic: number | null;
    respRate: number | null;
    tempC: number | null;
    isAbnormal: boolean;
    readingAt: string | null;
  };
}

const HISTORY_LENGTH = 40;

function Sparkline({ values, isAbnormal }: { values: number[]; isAbnormal: boolean }) {
  if (values.length < 2) return <div className="h-10" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * 100;
      const y = 32 - ((v - min) / range) * 28 - 2;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="h-10 w-full">
      <polyline
        points={points}
        fill="none"
        stroke={isAbnormal ? "#dc2626" : "#2563eb"}
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function VitalCard({
  label,
  value,
  unit,
  isAbnormal,
}: {
  label: string;
  value: number | string | null;
  unit?: string;
  isAbnormal?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        isAbnormal
          ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/20"
          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${isAbnormal ? "text-red-600" : "text-slate-800 dark:text-slate-100"}`}>
        {value ?? "—"}
        {value != null && unit && <span className="ml-1 text-sm font-medium text-slate-400">{unit}</span>}
      </p>
    </div>
  );
}

export default function VitalsMonitor({ mqttTopic, fallback }: VitalsMonitorProps) {
  const [live, setLive] = useState<VitalsPayload | null>(null);
  const [hasReceivedLive, setHasReceivedLive] = useState(false);
  const [history, setHistory] = useState<number[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeMqtt(mqttTopic, (payload: VitalsPayload) => {
      setLive(payload);
      setHasReceivedLive(true);
      if (typeof payload.heartRate === "number") {
        setHistory((h) => [...h.slice(-(HISTORY_LENGTH - 1)), payload.heartRate!]);
      }
    });
    return unsubscribe;
  }, [mqttTopic]);

  const isAbnormal = hasReceivedLive ? !!live?.isAbnormal : fallback.isAbnormal;
  const heartRate = hasReceivedLive ? live?.heartRate ?? null : fallback.heartRate;
  const spo2 = hasReceivedLive ? live?.spo2 ?? null : fallback.spo2;
  const systolic = hasReceivedLive ? live?.systolic ?? null : fallback.systolic;
  const diastolic = hasReceivedLive ? live?.diastolic ?? null : fallback.diastolic;
  const respRate = hasReceivedLive ? live?.respRate ?? null : fallback.respRate;
  const tempC = hasReceivedLive ? live?.tempC ?? null : fallback.tempC;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Live PPG monitor</p>
        {hasReceivedLive ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            Live
          </span>
        ) : isMqttConfigured ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            Waiting for signal...
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
            Showing last known reading (MQTT not configured)
          </span>
        )}
      </div>

      {isAbnormal && (
        <div className="mb-3 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          ⚠ Abnormal reading flagged
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <VitalCard label="Heart rate" value={heartRate} unit="bpm" isAbnormal={isAbnormal} />
        <VitalCard label="SpO₂" value={spo2} unit="%" isAbnormal={isAbnormal} />
        <VitalCard
          label="Blood pressure"
          value={systolic != null && diastolic != null ? `${systolic}/${diastolic}` : null}
          unit="mmHg"
        />
        <VitalCard label="Resp. rate" value={respRate} unit="/min" />
        <VitalCard label="Temperature" value={tempC} unit="°C" />
      </div>

      {history.length > 1 && (
        <div className="mt-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Heart rate trend
          </p>
          <Sparkline values={history} isAbnormal={isAbnormal} />
        </div>
      )}

      {!hasReceivedLive && fallback.readingAt && (
        <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
          Last updated {new Date(fallback.readingAt).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
