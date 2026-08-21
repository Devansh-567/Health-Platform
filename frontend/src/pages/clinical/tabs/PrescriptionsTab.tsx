import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { clinicalApi, Prescription, PrescriptionStatus } from "../../../api/clinical.api";
import { useAuth } from "../../../context/AuthContext";
import { PERMISSIONS } from "../../../constants/permissions";
import { Modal } from "../../../components/Modal";
import { Field, PrimaryButton, Alert } from "../../../components/FormControls";
import { StatusBadge } from "../../../components/UiPrimitives";

const itemSchema = z.object({
  medicineName: z.string().min(1, "Required").max(200),
  dosage: z.string().min(1, "Required").max(100),
  frequency: z.string().min(1, "Required").max(100),
  durationDays: z.string().max(10).optional(),
  instructions: z.string().max(500).optional(),
});

const schema = z.object({
  notes: z.string().max(1000).optional(),
  items: z.array(itemSchema).min(1, "At least one medicine is required"),
});
type FormValues = z.infer<typeof schema>;

const STATUS_OPTIONS: PrescriptionStatus[] = ["ACTIVE", "COMPLETED", "CANCELLED"];

export default function PrescriptionsTab({ patientUserId }: { patientUserId: string }) {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(PERMISSIONS.PRESCRIPTION_CREATE);

  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = () => {
    setIsLoading(true);
    clinicalApi
      .listPrescriptions(patientUserId)
      .then((res) => setPrescriptions(res.data ?? []))
      .catch((err) => setError(err?.message ?? "Failed to load prescriptions"))
      .finally(() => setIsLoading(false));
  };

  useEffect(load, [patientUserId]);

  const handleStatusChange = async (prescriptionId: string, status: PrescriptionStatus) => {
    setUpdatingId(prescriptionId);
    setError(null);
    try {
      await clinicalApi.updatePrescriptionStatus(prescriptionId, status);
      load();
    } catch (err: any) {
      // Backend restricts status changes to the prescribing doctor even if the
      // signed-in actor holds prescription.create in general — surface that
      // clearly rather than silently reverting the select.
      setError(err?.message ?? "Failed to update prescription status");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Prescriptions</h2>
        {canCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
          >
            + New prescription
          </button>
        )}
      </div>

      {error && <Alert>{error}</Alert>}

      {isLoading ? (
        <div className="text-sm text-slate-400 dark:text-slate-500">Loading...</div>
      ) : prescriptions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 px-4 py-6 text-center text-sm text-slate-400 dark:text-slate-500">
          No prescriptions recorded yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {prescriptions.map((p) => (
            <li key={p.id} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{new Date(p.createdAt).toLocaleString()}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Dr. {p.doctor.user.firstName} {p.doctor.user.lastName}
                  </p>
                </div>
                {canCreate ? (
                  <select
                    value={p.status}
                    disabled={updatingId === p.id}
                    onChange={(e) => handleStatusChange(p.id, e.target.value as PrescriptionStatus)}
                    className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-xs text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                ) : (
                  <StatusBadge value={p.status} />
                )}
              </div>

              <table className="mt-3 w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  <tr>
                    <th className="py-1 pr-4">Medicine</th>
                    <th className="py-1 pr-4">Dosage</th>
                    <th className="py-1 pr-4">Frequency</th>
                    <th className="py-1 pr-4">Duration</th>
                    <th className="py-1">Instructions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {p.items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-1.5 pr-4 font-medium text-slate-800 dark:text-slate-100">{item.medicineName}</td>
                      <td className="py-1.5 pr-4 text-slate-600 dark:text-slate-300">{item.dosage}</td>
                      <td className="py-1.5 pr-4 text-slate-600 dark:text-slate-300">{item.frequency}</td>
                      <td className="py-1.5 pr-4 text-slate-600 dark:text-slate-300">
                        {item.durationDays ? `${item.durationDays}d` : "—"}
                      </td>
                      <td className="py-1.5 text-slate-600 dark:text-slate-300">{item.instructions ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {p.notes && <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{p.notes}</p>}
            </li>
          ))}
        </ul>
      )}

      {showCreate && (
        <CreatePrescriptionModal
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

function CreatePrescriptionModal({
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
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { items: [{ medicineName: "", dosage: "", frequency: "", durationDays: "", instructions: "" }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  const onSubmit = async (values: FormValues) => {
    setError(null);
    try {
      await clinicalApi.createPrescription(patientUserId, {
        notes: values.notes || undefined,
        items: values.items.map((item) => ({
          medicineName: item.medicineName,
          dosage: item.dosage,
          frequency: item.frequency,
          durationDays: item.durationDays ? Number(item.durationDays) : undefined,
          instructions: item.instructions || undefined,
        })),
      });
      onCreated();
    } catch (err: any) {
      setError(err?.message ?? "Failed to create prescription");
    }
  };

  return (
    <Modal title="New prescription" onClose={onClose}>
      {error && <Alert>{error}</Alert>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Medicines</span>
          <button
            type="button"
            onClick={() => append({ medicineName: "", dosage: "", frequency: "", durationDays: "", instructions: "" })}
            className="text-xs font-medium text-brand-600 hover:underline"
          >
            + Add medicine
          </button>
        </div>

        {errors.items?.root && <p className="mb-2 text-xs text-red-500 dark:text-red-400">{errors.items.root.message}</p>}
        {errors.items?.message && <p className="mb-2 text-xs text-red-500 dark:text-red-400">{errors.items.message}</p>}

        <div className="mb-4 max-h-72 space-y-3 overflow-y-auto pr-1">
          {fields.map((field, index) => (
            <div key={field.id} className="rounded-lg border border-slate-200 dark:border-slate-600 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Medicine {index + 1}</span>
                {fields.length > 1 && (
                  <button type="button" onClick={() => remove(index)} className="text-xs font-medium text-red-600 hover:underline">
                    Remove
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field
                  label="Name"
                  error={errors.items?.[index]?.medicineName?.message}
                  {...register(`items.${index}.medicineName` as const)}
                />
                <Field label="Dosage" error={errors.items?.[index]?.dosage?.message} {...register(`items.${index}.dosage` as const)} />
                <Field
                  label="Frequency"
                  error={errors.items?.[index]?.frequency?.message}
                  {...register(`items.${index}.frequency` as const)}
                />
                <Field
                  label="Duration (days)"
                  type="number"
                  min={1}
                  error={errors.items?.[index]?.durationDays?.message}
                  {...register(`items.${index}.durationDays` as const)}
                />
              </div>
              <Field
                label="Instructions (optional)"
                error={errors.items?.[index]?.instructions?.message}
                {...register(`items.${index}.instructions` as const)}
              />
            </div>
          ))}
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
          Save prescription
        </PrimaryButton>
      </form>
    </Modal>
  );
}
