import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { clinicalApi, ClinicalNote } from "../../../api/clinical.api";
import { useAuth } from "../../../context/AuthContext";
import { PERMISSIONS } from "../../../constants/permissions";
import { Alert } from "../../../components/FormControls";

const schema = z.object({ content: z.string().min(1, "Note can't be empty").max(4000) });
type FormValues = z.infer<typeof schema>;

const NOTE_TYPE_LABEL: Record<ClinicalNote["type"], string> = {
  DOCTOR_NOTE: "Doctor note",
  NURSING_NOTE: "Nursing note",
};

// Unlike the other tabs, note creation is inline (not a modal) — clinical
// notes are typically jotted quickly during or right after a visit, and
// there's exactly one field, so a modal would only add friction.
export default function NotesTab({ patientUserId }: { patientUserId: string }) {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(PERMISSIONS.MEDICAL_NOTE_CREATE, PERMISSIONS.NURSING_NOTE_CREATE);

  const [notes, setNotes] = useState<ClinicalNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const load = () => {
    setIsLoading(true);
    clinicalApi
      .listNotes(patientUserId)
      .then((res) => setNotes(res.data ?? []))
      .catch((err) => setError(err?.message ?? "Failed to load notes"))
      .finally(() => setIsLoading(false));
  };

  useEffect(load, [patientUserId]);

  const onSubmit = async (values: FormValues) => {
    setError(null);
    try {
      await clinicalApi.createNote(patientUserId, values.content);
      reset();
      load();
    } catch (err: any) {
      setError(err?.message ?? "Failed to add note");
    }
  };

  return (
    <div>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Clinical Notes</h2>

      {error && <Alert>{error}</Alert>}

      {canCreate && (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="mb-6 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
          <textarea
            rows={3}
            placeholder="Add a note..."
            {...register("content")}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand-500"
          />
          {errors.content && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.content.message}</p>}
          <div className="mt-2 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {isSubmitting ? "Saving..." : "Add note"}
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="text-sm text-slate-400 dark:text-slate-500">Loading...</div>
      ) : notes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 px-4 py-6 text-center text-sm text-slate-400 dark:text-slate-500">
          No notes yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li key={n.id} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
              <div className="mb-1 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
                <span className="font-medium text-slate-500 dark:text-slate-400">{NOTE_TYPE_LABEL[n.type]}</span>
                <span>{new Date(n.createdAt).toLocaleString()}</span>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-200">{n.content}</p>
              <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                {n.author.firstName} {n.author.lastName}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
