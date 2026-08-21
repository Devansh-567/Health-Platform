import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { authApi } from "../api/auth.api";
import { profileApi, PatientProfile, Gender, BloodGroup } from "../api/profile.api";
import { useAuth } from "../context/AuthContext";
import { PageHeader } from "../components/UiPrimitives";
import { PasswordField, PrimaryButton, Alert, Field, SelectField } from "../components/FormControls";

const passwordRule = z
  .string()
  .min(10, "At least 10 characters")
  .regex(/[a-z]/, "Needs a lowercase letter")
  .regex(/[A-Z]/, "Needs an uppercase letter")
  .regex(/[0-9]/, "Needs a number")
  .regex(/[^a-zA-Z0-9]/, "Needs a special character");

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Required"),
    newPassword: passwordRule,
    confirmNewPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmNewPassword, {
    message: "Passwords do not match",
    path: ["confirmNewPassword"],
  });

type PasswordFormValues = z.infer<typeof passwordSchema>;

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  DOCTOR: "Doctor",
  NURSE: "Nurse",
  PATIENT: "Patient",
};

export default function AccountSettingsPage() {
  const { user, hasRole, refreshUser } = useAuth();
  const location = useLocation();
  const forcedPasswordChange = Boolean((location.state as any)?.forcedPasswordChange) || user?.mustChangePassword;
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordFormValues>({ resolver: zodResolver(passwordSchema) });

  const onSubmit = async (values: PasswordFormValues) => {
    setServerError(null);
    setSuccess(false);
    try {
      await authApi.changePassword(values.currentPassword, values.newPassword);
      setSuccess(true);
      reset();
      // mustChangePassword flips server-side on a successful change — pull
      // the fresh value so ProtectedRoute stops redirecting here.
      await refreshUser();
    } catch (err: any) {
      if (err?.code === "INVALID_CURRENT_PASSWORD") setServerError("Current password is incorrect.");
      else setServerError(err?.message ?? "Failed to change password.");
    }
  };

  return (
    <div className="p-8">
      <PageHeader title="Account settings" subtitle="Manage your profile and security" />

      {forcedPasswordChange && !success && (
        <Alert>
          You're signed in with a temporary password. Please set your own password below before continuing.
        </Alert>
      )}

      <div className="mb-8 max-w-lg rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Profile</h2>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-slate-500 dark:text-slate-400">Name</dt>
            <dd className="text-slate-800 dark:text-slate-100">{user?.firstName} {user?.lastName}</dd>
          </div>
          <div>
            <dt className="text-slate-500 dark:text-slate-400">Email</dt>
            <dd className="text-slate-800 dark:text-slate-100">{user?.email}</dd>
          </div>
          <div>
            <dt className="text-slate-500 dark:text-slate-400">Role</dt>
            <dd className="text-slate-800 dark:text-slate-100">{ROLE_LABEL[user?.role ?? ""] ?? user?.role}</dd>
          </div>
        </dl>
      </div>

      {/* Only PATIENT accounts have self-service demographic fields today —
          see backend/src/modules/profile/profile.service.ts. Checking the
          role here is purely a display decision (skip rendering a form with
          nothing to show); the server is still the actual enforcement
          boundary if this ever renders for the wrong role. */}
      {hasRole("PATIENT") && <PatientProfileCard />}

      <div className="max-w-lg rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Change password</h2>

        {success && <Alert variant="success">Password changed successfully.</Alert>}
        {serverError && <Alert>{serverError}</Alert>}

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <PasswordField
            label="Current password"
            autoComplete="current-password"
            error={errors.currentPassword?.message}
            {...register("currentPassword")}
          />
          <PasswordField
            label="New password"
            autoComplete="new-password"
            error={errors.newPassword?.message}
            {...register("newPassword")}
          />
          <PasswordField
            label="Confirm new password"
            autoComplete="new-password"
            error={errors.confirmNewPassword?.message}
            {...register("confirmNewPassword")}
          />
          <PrimaryButton type="submit" isLoading={isSubmitting}>Update password</PrimaryButton>
        </form>
      </div>
    </div>
  );
}

const GENDER_OPTIONS = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
  { value: "PREFER_NOT_TO_SAY", label: "Prefer not to say" },
];

const BLOOD_GROUP_OPTIONS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "UNKNOWN"].map((v) => ({
  value: v,
  label: v === "UNKNOWN" ? "Unknown" : v,
}));

const patientProfileSchema = z.object({
  dateOfBirth: z.string().optional().or(z.literal("")),
  gender: z.enum(["", "MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"]).optional(),
  bloodGroup: z.enum(["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "UNKNOWN"]).optional(),
  medicalRecordNo: z
    .string()
    .trim()
    .max(50, "Must be at most 50 characters")
    .refine((v) => v === "" || /^[A-Za-z0-9-]{3,}$/.test(v), "Letters, numbers, and hyphens only, at least 3 characters")
    .optional()
    .or(z.literal("")),
  address: z.string().trim().max(300, "Must be at most 300 characters").optional().or(z.literal("")),
  emergencyContact: z.string().trim().max(150, "Must be at most 150 characters").optional().or(z.literal("")),
  emergencyPhone: z
    .string()
    .trim()
    .max(20, "Must be at most 20 characters")
    .refine((v) => v === "" || /^[0-9+()\-\s]{7,}$/.test(v), "Invalid phone number")
    .optional()
    .or(z.literal("")),
});

type PatientProfileFormValues = z.infer<typeof patientProfileSchema>;

/** Converts an ISO datetime string to the yyyy-mm-dd shape <input type="date"> expects. */
function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function PatientProfileCard() {
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<PatientProfileFormValues>({ resolver: zodResolver(patientProfileSchema) });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await profileApi.getMine();
        if (cancelled) return;
        const p = res.data?.profile ?? null;
        setProfile(p);
        reset({
          dateOfBirth: toDateInputValue(p?.dateOfBirth ?? null),
          gender: (p?.gender as Gender) ?? "",
          bloodGroup: (p?.bloodGroup as BloodGroup) ?? "",
          medicalRecordNo: p?.medicalRecordNo ?? "",
          address: p?.address ?? "",
          emergencyContact: p?.emergencyContact ?? "",
          emergencyPhone: p?.emergencyPhone ?? "",
        });
      } catch (err: any) {
        if (!cancelled) setLoadError(err?.message ?? "Failed to load your profile.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reset]);

  const onSubmit = async (values: PatientProfileFormValues) => {
    setServerError(null);
    setSuccess(false);

    const payload: Record<string, string> = {};
    if (values.dateOfBirth) payload.dateOfBirth = values.dateOfBirth;
    if (values.gender) payload.gender = values.gender;
    if (values.bloodGroup) payload.bloodGroup = values.bloodGroup;
    if (values.medicalRecordNo) payload.medicalRecordNo = values.medicalRecordNo;
    if (values.address) payload.address = values.address;
    if (values.emergencyContact) payload.emergencyContact = values.emergencyContact;
    if (values.emergencyPhone) payload.emergencyPhone = values.emergencyPhone;

    if (Object.keys(payload).length === 0) {
      setServerError("Change at least one field before saving.");
      return;
    }

    try {
      const res = await profileApi.updateMine(payload);
      const updated = res.data ?? null;
      setProfile(updated);
      setSuccess(true);
      reset(values); // clear "dirty" state on the values just saved
    } catch (err: any) {
      if (err?.code === "DUPLICATE_ENTRY") setServerError("That medical record number is already in use on another account.");
      else setServerError(err?.message ?? "Failed to update your profile.");
    }
  };

  return (
    <div className="mb-8 max-w-lg rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Patient details</h2>
      <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
        This information helps your care team and is visible only to hospital staff assigned to you.
      </p>

      {isLoading && <p className="text-sm text-slate-500 dark:text-slate-400">Loading...</p>}
      {loadError && <Alert>{loadError}</Alert>}

      {!isLoading && !loadError && (
        <>
          {success && <Alert variant="success">Patient details updated.</Alert>}
          {serverError && <Alert>{serverError}</Alert>}

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="grid grid-cols-2 gap-x-4">
              <Field
                type="date"
                label="Date of birth"
                max={toDateInputValue(new Date().toISOString())}
                error={errors.dateOfBirth?.message}
                {...register("dateOfBirth")}
              />
              <SelectField
                label="Gender"
                placeholder="Select..."
                options={GENDER_OPTIONS}
                error={errors.gender?.message}
                {...register("gender")}
              />
            </div>

            <div className="grid grid-cols-2 gap-x-4">
              <SelectField
                label="Blood group"
                placeholder="Select..."
                options={BLOOD_GROUP_OPTIONS}
                error={errors.bloodGroup?.message}
                {...register("bloodGroup")}
              />
              <Field
                label="Medical record no."
                placeholder="e.g. from a prior hospital"
                error={errors.medicalRecordNo?.message}
                {...register("medicalRecordNo")}
              />
            </div>

            <Field label="Address" error={errors.address?.message} {...register("address")} />

            <div className="grid grid-cols-2 gap-x-4">
              <Field
                label="Emergency contact name"
                error={errors.emergencyContact?.message}
                {...register("emergencyContact")}
              />
              <Field
                label="Emergency contact phone"
                type="tel"
                error={errors.emergencyPhone?.message}
                {...register("emergencyPhone")}
              />
            </div>

            <PrimaryButton type="submit" isLoading={isSubmitting} disabled={!isDirty}>
              Save patient details
            </PrimaryButton>
          </form>
        </>
      )}
    </div>
  );
}
