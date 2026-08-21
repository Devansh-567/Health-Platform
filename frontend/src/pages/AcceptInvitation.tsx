import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { authApi } from "../api/auth.api";
import { AuthCard } from "../components/AuthCard";
import { Field, PasswordField, PrimaryButton, Alert } from "../components/FormControls";
import { FullscreenLoader } from "../routes/ProtectedRoute";

const passwordRule = z
  .string()
  .min(10, "At least 10 characters")
  .regex(/[a-z]/, "Needs a lowercase letter")
  .regex(/[A-Z]/, "Needs an uppercase letter")
  .regex(/[0-9]/, "Needs a number")
  .regex(/[^a-zA-Z0-9]/, "Needs a special character");

const schema = z
  .object({
    firstName: z.string().min(1, "Required"),
    lastName: z.string().min(1, "Required"),
    phone: z.string().optional(),
    password: passwordRule,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, { message: "Passwords do not match", path: ["confirmPassword"] });

type FormValues = z.infer<typeof schema>;

export default function AcceptInvitationPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();

  const [invite, setInvite] = useState<{ email: string; role: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (!token) {
      setLoadError("Invitation link is missing a token.");
      return;
    }
    authApi
      .getInvitation(token)
      .then((res) => setInvite(res.data ?? null))
      .catch((err) => setLoadError(err?.message ?? "This invitation is invalid or has expired."));
  }, [token]);

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      await authApi.acceptInvitation({ token, ...values, phone: values.phone || undefined });
      navigate("/login", { state: { invitationAccepted: true } });
    } catch (err: any) {
      setServerError(err?.message ?? "Could not complete setup. Please try again.");
    }
  };

  if (loadError) {
    return (
      <AuthCard title="Invitation unavailable">
        <Alert>{loadError}</Alert>
        <Link to="/login" className="text-sm font-medium text-brand-600 hover:underline">
          Go to login
        </Link>
      </AuthCard>
    );
  }

  if (!invite) return <FullscreenLoader />;

  return (
    <AuthCard title="Complete your account" subtitle={`Joining as ${invite.role} — ${invite.email}`}>
      {serverError && <Alert>{serverError}</Alert>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" error={errors.firstName?.message} {...register("firstName")} />
          <Field label="Last name" error={errors.lastName?.message} {...register("lastName")} />
        </div>
        <Field label="Phone (optional)" type="tel" error={errors.phone?.message} {...register("phone")} />
        <PasswordField label="Password" autoComplete="new-password" error={errors.password?.message} {...register("password")} />
        <PasswordField label="Confirm password" autoComplete="new-password" error={errors.confirmPassword?.message} {...register("confirmPassword")} />
        <PrimaryButton type="submit" isLoading={isSubmitting}>Activate account</PrimaryButton>
      </form>
    </AuthCard>
  );
}