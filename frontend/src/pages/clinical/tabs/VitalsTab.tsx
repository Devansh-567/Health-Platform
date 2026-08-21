import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { clinicalApi, VitalSign } from "../../../api/clinical.api";
import { useAuth } from "../../../context/AuthContext";
import { PERMISSIONS } from "../../../constants/permissions";
import { Modal } from "../../../components/Modal";
import { Field, PrimaryButton, Alert } from "../../../components/FormControls";

interface FormValues {
  bloodPressureSystolic: string;
  bloodPressureDiastolic: string;
  heartRate: string;
  temperatureCelsius: string;
  respiratoryRate: string;
  oxygenSaturation: string;
  weightKg: string;
  heightCm: string;
  notes: string;
}

const EMPTY_FORM: FormValues = {
  bloodPressureSystolic: "",
  bloodPressureDiastolic: "",
  heartRate: "",
  temperatureCelsius: "",
  respiratoryRate: "",
  oxygenSaturation: "",
  weightKg: "",
  heightCm: "",
  notes: "",
};

export default function VitalsTab({ patientUserId }: { patientUserId: string }) {
  const { hasPermission } = useAuth();
  const canRecord = hasPermission(PERMISSIONS.VITALS_RECORD);

  const [vitals, setVitals] = useState<VitalSign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = () => {
    setIsLoading(true);
    clinicalApi
      .listVitals(patientUserId)
      .then((res) => setVitals(res.data ?? []))
      .catch((err) => setError(err?.message ?? "Failed to load vitals"))
      .finally(() => setIsLoading(false));
  };

  useEffect(load, [patientUserId]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Vitals</h2>
        {canRecord && (
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
          >
            + Record vitals
          </button>
        )}
      </div>

      {error && <Alert>{error}</Alert>}

      {isLoading ? (
        <div className="text-sm text-slate-400 dark:text-slate-500">Loading...</div>
      ) : vitals.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 px-4 py-6 text-center text-sm text-slate-400 dark:text-slate-500">
          No vitals recorded yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-3 py-2">Recorded</th>
                <th className="px-3 py-2">BP</th>
                <th className="px-3 py-2">HR</th>
                <th className="px-3 py-2">Temp</th>
                <th className="px-3 py-2">RR</th>
                <th className="px-3 py-2">SpO2</th>
                <th className="px-3 py-2">Weight</th>
                <th className="px-3 py-2">Height</th>
                <th className="px-3 py-2">By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {vitals.map((v) => (
                <tr key={v.id}>
                  <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{new Date(v.recordedAt).toLocaleString()}</td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                    {v.bloodPressureSystolic && v.bloodPressureDiastolic ? `${v.bloodPressureSystolic}/${v.bloodPressureDiastolic}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{v.heartRate ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{v.temperatureCelsius ? `${v.temperatureCelsius}°C` : "—"}</td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{v.respiratoryRate ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{v.oxygenSaturation ? `${v.oxygenSaturation}%` : "—"}</td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{v.weightKg ? `${v.weightKg}kg` : "—"}</td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{v.heightCm ? `${v.heightCm}cm` : "—"}</td>
                  <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                    {v.recordedBy.firstName} {v.recordedBy.lastName}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <RecordVitalsModal
          patientUserId={patientUserId}
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

function RecordVitalsModal({
  patientUserId,
  onClose,
  onCreated,
}: {
  patientUserId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FormValues>({ defaultValues: EMPTY_FORM });

  const onSubmit = async (values: FormValues) => {
    setError(null);
    const toNumber = (v: string) => (v.trim() === "" ? undefined : Number(v));
    try {
      await clinicalApi.recordVitals(patientUserId, {
        bloodPressureSystolic: toNumber(values.bloodPressureSystolic),
        bloodPressureDiastolic: toNumber(values.bloodPressureDiastolic),
        heartRate: toNumber(values.heartRate),
        temperatureCelsius: toNumber(values.temperatureCelsius),
        respiratoryRate: toNumber(values.respiratoryRate),
        oxygenSaturation: toNumber(values.oxygenSaturation),
        weightKg: toNumber(values.weightKg),
        heightCm: toNumber(values.heightCm),
        notes: values.notes || undefined,
      });
      onCreated();
    } catch (err: any) {
      setError(err?.message ?? "Failed to record vitals");
    }
  };

  return (
    <Modal title="Record vitals" onClose={onClose}>
      {error && <Alert>{error}</Alert>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="grid grid-cols-2 gap-2">
          <Field label="BP Systolic" type="number" {...register("bloodPressureSystolic")} />
          <Field label="BP Diastolic" type="number" {...register("bloodPressureDiastolic")} />
          <Field label="Heart rate (bpm)" type="number" {...register("heartRate")} />
          <Field label="Temperature (°C)" type="number" step="0.1" {...register("temperatureCelsius")} />
          <Field label="Respiratory rate" type="number" {...register("respiratoryRate")} />
          <Field label="Oxygen saturation (%)" type="number" {...register("oxygenSaturation")} />
          <Field label="Weight (kg)" type="number" step="0.1" {...register("weightKg")} />
          <Field label="Height (cm)" type="number" step="0.1" {...register("heightCm")} />
        </div>
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Notes (optional)</label>
          <textarea
            rows={2}
            {...register("notes")}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <PrimaryButton type="submit" isLoading={isSubmitting}>
          Save vitals
        </PrimaryButton>
      </form>
    </Modal>
  );
}
