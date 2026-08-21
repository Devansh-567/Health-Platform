import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  appointmentsApi,
  AppointmentListItem,
  AppointmentStatus,
  BookableDoctor,
  PatientSearchResult,
} from "../../api/appointments.api";
import { useAuth } from "../../context/AuthContext";
import { PERMISSIONS } from "../../constants/permissions";
import { hospitalsApi, Hospital } from "../../api/hospitals.api";
import { PageHeader, StatusBadge, Pagination } from "../../components/UiPrimitives";
import { Modal } from "../../components/Modal";
import { Field, PrimaryButton, Alert } from "../../components/FormControls";

const STATUS_FILTERS: { value: AppointmentStatus | ""; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "REQUESTED", label: "Requested" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "COMPLETED", label: "Completed" },
  { value: "NO_SHOW", label: "No-show" },
];

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];

function formatRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const sameDay = s.toDateString() === e.toDateString();
  return `${s.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} – ${e.toLocaleTimeString(undefined, {
    timeStyle: "short",
  })}${sameDay ? "" : ` (${e.toLocaleDateString()})`}`;
}

export default function AppointmentsPage() {
  const { user, hasPermission, hasRole } = useAuth();
  const canBook = hasPermission(PERMISSIONS.APPOINTMENT_BOOK, PERMISSIONS.APPOINTMENT_MANAGE_ANY);
  const canManage = hasPermission(PERMISSIONS.APPOINTMENT_MANAGE_OWN, PERMISSIONS.APPOINTMENT_MANAGE_ANY);
  const isPatient = user?.role === "PATIENT";
  const isSuperAdmin = hasRole("SUPER_ADMIN");

  const [items, setItems] = useState<AppointmentListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<AppointmentStatus | "">("");
  // Super Admin only: every other role is already hospital/assignment-scoped
  // server-side, so this filter is neither shown nor sent for anyone else.
  const [hospitalId, setHospitalId] = useState("");
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBooking, setShowBooking] = useState(false);
  const [rescheduling, setRescheduling] = useState<AppointmentListItem | null>(null);
  const [cancelling, setCancelling] = useState<AppointmentListItem | null>(null);
  const pageSize = 10;

  useEffect(() => {
    if (isSuperAdmin) {
      hospitalsApi.list({ isActive: "true", pageSize: 100 }).then((res) => setHospitals(res.data?.items ?? []));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin]);

  const load = async () => {
    setIsLoading(true);
    try {
      const res = await appointmentsApi.list({
        status: status || undefined,
        hospitalId: isSuperAdmin ? hospitalId || undefined : undefined,
        page,
        pageSize,
      });
      setItems(res.data?.items ?? []);
      setTotal(res.data?.total ?? 0);
      setError(null);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load appointments");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status, hospitalId]);

  useEffect(() => {
    setPage(1);
  }, [status, hospitalId]);

  const runAction = async (action: () => Promise<unknown>) => {
    try {
      await action();
      load();
    } catch (err: any) {
      alert(err?.message ?? "That action couldn't be completed");
    }
  };

  return (
    <div className="p-8">
      <PageHeader
        title="Appointments"
        subtitle={isPatient ? "Book and manage your upcoming visits" : "Scheduled visits across your patients"}
        action={
          canBook ? (
            <button
              onClick={() => setShowBooking(true)}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              + Book appointment
            </button>
          ) : undefined
        }
      />

      <div className="mb-4 flex gap-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as AppointmentStatus | "")}
          className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand-500"
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>

        {isSuperAdmin && (
          <select
            value={hospitalId}
            onChange={(e) => setHospitalId(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All hospitals</option>
            {hospitals.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {error ? (
        <Alert>{error}</Alert>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">When</th>
                {!isPatient && <th className="px-4 py-3">Patient</th>}
                <th className="px-4 py-3">Doctor</th>
                {isSuperAdmin && <th className="px-4 py-3">Hospital</th>}
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={isSuperAdmin ? 7 : 6} className="px-4 py-6 text-center text-slate-400 dark:text-slate-500">
                    Loading...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={isSuperAdmin ? 7 : 6} className="px-4 py-6 text-center text-slate-400 dark:text-slate-500">
                    No appointments found.
                  </td>
                </tr>
              ) : (
                items.map((appt) => (
                  <tr key={appt.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{formatRange(appt.scheduledStart, appt.scheduledEnd)}</td>
                    {!isPatient && (
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                        {appt.patient.user.firstName} {appt.patient.user.lastName}
                      </td>
                    )}
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                      Dr. {appt.doctor.user.firstName} {appt.doctor.user.lastName}
                      {appt.doctor.specialization && <span className="block text-xs text-slate-400 dark:text-slate-500">{appt.doctor.specialization}</span>}
                    </td>
                    {isSuperAdmin && <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{appt.hospital.name}</td>}
                    <td className="px-4 py-3 max-w-xs truncate text-slate-500 dark:text-slate-400">{appt.reason || "—"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge value={appt.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-3 whitespace-nowrap">
                        {canManage && appt.status === "REQUESTED" && (
                          <button
                            onClick={() => runAction(() => appointmentsApi.confirm(appt.id))}
                            className="text-sm font-medium text-brand-600 hover:underline"
                          >
                            Confirm
                          </button>
                        )}
                        {canManage && appt.status === "CONFIRMED" && (
                          <>
                            <button
                              onClick={() => runAction(() => appointmentsApi.complete(appt.id))}
                              className="text-sm font-medium text-brand-600 hover:underline"
                            >
                              Complete
                            </button>
                            <button
                              onClick={() => runAction(() => appointmentsApi.markNoShow(appt.id))}
                              className="text-sm font-medium text-slate-500 dark:text-slate-400 hover:underline"
                            >
                              No-show
                            </button>
                            <button onClick={() => setRescheduling(appt)} className="text-sm font-medium text-slate-500 dark:text-slate-400 hover:underline">
                              Reschedule
                            </button>
                          </>
                        )}
                        {(appt.status === "REQUESTED" || appt.status === "CONFIRMED") && (
                          <button onClick={() => setCancelling(appt)} className="text-sm font-medium text-red-600 hover:underline">
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />

      {showBooking && <BookAppointmentModal onClose={() => setShowBooking(false)} onBooked={() => { setShowBooking(false); load(); }} />}
      {rescheduling && (
        <RescheduleModal
          appointment={rescheduling}
          onClose={() => setRescheduling(null)}
          onDone={() => {
            setRescheduling(null);
            load();
          }}
        />
      )}
      {cancelling && (
        <CancelModal
          appointment={cancelling}
          onClose={() => setCancelling(null)}
          onDone={() => {
            setCancelling(null);
            load();
          }}
        />
      )}
    </div>
  );
}

const bookingSchema = z.object({
  doctorUserId: z.string().min(1, "Select a doctor"),
  date: z.string().min(1, "Select a date"),
  time: z.string().min(1, "Select a time"),
  durationMinutes: z.coerce.number(),
  reason: z.string().max(500).optional(),
});
type BookingValues = z.infer<typeof bookingSchema>;

function BookAppointmentModal({ onClose, onBooked }: { onClose: () => void; onBooked: () => void }) {
  const { user, hasPermission } = useAuth();
  // Patients always book for themselves. Admins/Super Admins schedule a
  // walk-in visit on behalf of a specific patient they look up below.
  const bookingForSelf = user?.role === "PATIENT";
  const canPickPatient = hasPermission(PERMISSIONS.APPOINTMENT_MANAGE_ANY) && !bookingForSelf;

  const [serverError, setServerError] = useState<string | null>(null);
  const [doctors, setDoctors] = useState<BookableDoctor[]>([]);
  const [doctorSearch, setDoctorSearch] = useState("");
  const [patientSearch, setPatientSearch] = useState("");
  const [patients, setPatients] = useState<PatientSearchResult[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientSearchResult | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BookingValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: { durationMinutes: 30 },
  });

  useEffect(() => {
    const handle = setTimeout(() => {
      appointmentsApi.listDoctors({ search: doctorSearch || undefined }).then((res) => setDoctors(res.data ?? []));
    }, 250);
    return () => clearTimeout(handle);
  }, [doctorSearch]);

  useEffect(() => {
    if (!canPickPatient || patientSearch.trim().length < 2) {
      setPatients([]);
      return;
    }
    const handle = setTimeout(() => {
      appointmentsApi.searchPatients(patientSearch.trim()).then((res) => setPatients(res.data ?? []));
    }, 250);
    return () => clearTimeout(handle);
  }, [patientSearch, canPickPatient]);

  const onSubmit = async (values: BookingValues) => {
    setServerError(null);
    if (canPickPatient && !selectedPatient) {
      setServerError("Select a patient for this appointment");
      return;
    }
    const start = new Date(`${values.date}T${values.time}`);
    const end = new Date(start.getTime() + values.durationMinutes * 60000);
    try {
      await appointmentsApi.book({
        doctorUserId: values.doctorUserId,
        patientUserId: canPickPatient ? selectedPatient!.id : undefined,
        scheduledStart: start.toISOString(),
        scheduledEnd: end.toISOString(),
        reason: values.reason || undefined,
      });
      onBooked();
    } catch (err: any) {
      setServerError(err?.message ?? "Failed to book appointment");
    }
  };

  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <Modal title="Book appointment" onClose={onClose}>
      {serverError && <Alert>{serverError}</Alert>}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        {canPickPatient && (
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Patient</label>
            {selectedPatient ? (
              <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm">
                <span>
                  {selectedPatient.firstName} {selectedPatient.lastName} <span className="text-slate-400">({selectedPatient.email})</span>
                </span>
                <button type="button" onClick={() => setSelectedPatient(null)} className="text-slate-400 hover:text-slate-600">
                  Change
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  placeholder="Search patient by name or email"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand-500"
                />
                {patients.length > 0 && (
                  <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
                    {patients.map((p) => (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => {
                          setSelectedPatient(p);
                          setPatients([]);
                        }}
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
                      >
                        {p.firstName} {p.lastName} <span className="text-slate-400">({p.email})</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Doctor</label>
          <input
            type="text"
            value={doctorSearch}
            onChange={(e) => setDoctorSearch(e.target.value)}
            placeholder="Search by name or specialization"
            className="mb-2 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand-500"
          />
          <select
            {...register("doctorUserId")}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">— Select a doctor —</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                Dr. {d.firstName} {d.lastName}
                {d.doctorProfile?.specialization ? ` · ${d.doctorProfile.specialization}` : ""}
                {d.hospital ? ` · ${d.hospital.name}` : ""}
              </option>
            ))}
          </select>
          {errors.doctorUserId && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.doctorUserId.message}</p>}
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <Field label="Date" type="date" min={todayIso} error={errors.date?.message} {...register("date")} />
          <Field label="Time" type="time" error={errors.time?.message} {...register("time")} />
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Duration</label>
          <select
            {...register("durationMinutes")}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand-500"
          >
            {DURATION_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m} minutes
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Reason (optional)</label>
          <textarea
            {...register("reason")}
            rows={2}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <PrimaryButton type="submit" isLoading={isSubmitting}>
          Book appointment
        </PrimaryButton>
      </form>
    </Modal>
  );
}

function toDateInputValue(iso: string) {
  return new Date(iso).toISOString().slice(0, 10);
}
function toTimeInputValue(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function RescheduleModal({ appointment, onClose, onDone }: { appointment: AppointmentListItem; onClose: () => void; onDone: () => void }) {
  const [date, setDate] = useState(toDateInputValue(appointment.scheduledStart));
  const [time, setTime] = useState(toTimeInputValue(appointment.scheduledStart));
  const durationMs = new Date(appointment.scheduledEnd).getTime() - new Date(appointment.scheduledStart).getTime();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const start = new Date(`${date}T${time}`);
      const end = new Date(start.getTime() + durationMs);
      await appointmentsApi.reschedule(appointment.id, { scheduledStart: start.toISOString(), scheduledEnd: end.toISOString() });
      onDone();
    } catch (err: any) {
      setError(err?.message ?? "Failed to reschedule appointment");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title="Reschedule appointment" onClose={onClose}>
      {error && <Alert>{error}</Alert>}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <Field label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Field label="Time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      </div>
      <PrimaryButton onClick={onSubmit} isLoading={isSubmitting}>
        Save new time
      </PrimaryButton>
    </Modal>
  );
}

function CancelModal({ appointment, onClose, onDone }: { appointment: AppointmentListItem; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await appointmentsApi.cancel(appointment.id, reason || undefined);
      onDone();
    } catch (err: any) {
      setError(err?.message ?? "Failed to cancel appointment");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title="Cancel appointment" onClose={onClose}>
      {error && <Alert>{error}</Alert>}
      <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
        Cancel the {formatRange(appointment.scheduledStart, appointment.scheduledEnd)} appointment with Dr. {appointment.doctor.user.firstName}{" "}
        {appointment.doctor.user.lastName}?
      </p>
      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Reason (optional)</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>
      <button
        onClick={onSubmit}
        disabled={isSubmitting}
        className="flex w-full items-center justify-center rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Please wait..." : "Cancel appointment"}
      </button>
    </Modal>
  );
}
