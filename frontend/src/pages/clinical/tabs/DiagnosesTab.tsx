import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { clinicalApi, Diagnosis } from "../../../api/clinical.api";
import { useAuth } from "../../../context/AuthContext";
import { PERMISSIONS } from "../../../constants/permissions";
import { Modal } from "../../../components/Modal";
import { Field, PrimaryButton, Alert } from "../../../components/FormControls";

const schema = z.object({
  condition: z.string().min(2, "Condition is required").max(300),
  description: z.string().max(2000).optional(),
});
type FormValues = z.infer<typeof schema>;

export default function DiagnosesTab({ patientUserId }: { patientUserId: string }) {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(PERMISSIONS.DIAGNOSIS_CREATE);

  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = () => {
    setIsLoading(true);
    clinicalApi
      .listDiagnoses(patientUserId)
      .then((res) => setDiagnoses(res.data ?? []))
      .catch((err) => setError(err?.message ?? "Failed to load diagnoses"))
      .finally(() => setIsLoading(false));
  };

  useEffect(load, [patientUserId]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Diagnoses</h2>
        {canCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
          >
            + Add diagnosis
          </button>
        )}
      </div>

      {error && <Alert>{error}</Alert>}

      {isLoading ? (
        <div className="text-sm text-slate-400 dark:text-slate-500">Loading...</div>
      ) : diagnoses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 px-4 py-6 text-center text-sm text-slate-400 dark:text-slate-500">
          No diagnoses recorded yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {diagnoses.map((d) => (
            <li key={d.id} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
              <div className="flex items-start justify-between">
                <p className="font-medium text-slate-800 dark:text-slate-100">{d.condition}</p>
                <span className="text-xs text-slate-400 dark:text-slate-500">{new Date(d.diagnosedAt).toLocaleDateString()}</span>
              </div>
              {d.description && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{d.description}</p>}
              <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                Dr. {d.doctor.user.firstName} {d.doctor.user.lastName}
              </p>
            </li>
          ))}
        </ul>
      )}

      {showCreate && (
        <CreateDiagnosisModal
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

function CreateDiagnosisModal({
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
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setError(null);
    try {
      await clinicalApi.createDiagnosis(patientUserId, values);
      onCreated();
    } catch (err: any) {
      setError(err?.message ?? "Failed to create diagnosis");
    }
  };

  return (
    <Modal title="Add diagnosis" onClose={onClose}>
      {error && <Alert>{error}</Alert>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field label="Condition" error={errors.condition?.message} {...register("condition")} />
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Description (optional)</label>
          <textarea
            rows={4}
            {...register("description")}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand-500"
          />
          {errors.description && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.description.message}</p>}
        </div>
        <PrimaryButton type="submit" isLoading={isSubmitting}>
          Save diagnosis
        </PrimaryButton>
      </form>
    </Modal>
  );
}
