import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { authApi } from "../api/auth.api";
import { AuthCard } from "../components/AuthCard";
import { Field, PasswordField, PrimaryButton, Alert } from "../components/FormControls";

const passwordRule = z
  .string()
  .min(10, "At least 10 characters")
  .regex(/[a-z]/, "Needs a lowercase letter")
  .regex(/[A-Z]/, "Needs an uppercase letter")
  .regex(/[0-9]/, "Needs a number")
  .regex(/[^a-zA-Z0-9]/, "Needs a special character");

const schema = z
  .object({ password: passwordRule, confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, { message: "Passwords do not match", path: ["confirmPassword"] });

type FormValues = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      await authApi.resetPassword(token, values.password);
      navigate("/login", { state: { resetSuccess: true } });
    } catch (err: any) {
      setServerError(err?.message ?? "This reset link is invalid or expired.");
    }
  };

  if (!token) {
    return (
      <AuthCard title="Invalid link">
        <Alert>This password reset link is missing or malformed.</Alert>
        <Link to="/forgot-password" className="text-sm font-medium text-brand-600 hover:underline">
          Request a new link
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Set a new password">
      {serverError && <Alert>{serverError}</Alert>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <PasswordField label="New password" autoComplete="new-password" error={errors.password?.message} {...register("password")} />
        <PasswordField label="Confirm new password" autoComplete="new-password" error={errors.confirmPassword?.message} {...register("confirmPassword")} />
        <PrimaryButton type="submit" isLoading={isSubmitting}>Reset password</PrimaryButton>
      </form>
    </AuthCard>
  );
}