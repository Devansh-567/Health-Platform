import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { authApi } from "../api/auth.api";
import { AuthCard } from "../components/AuthCard";
import { Field, PrimaryButton, Alert } from "../components/FormControls";

const schema = z.object({ email: z.string().email("Enter a valid email") });
type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values: FormValues) => {
    await authApi.forgotPassword(values.email);
    setSent(true); // Always show success — never reveal whether the email exists.
  };

  return (
    <AuthCard title="Reset your password" subtitle="We'll email you a reset link">
      {sent ? (
        <Alert variant="success">If that email exists in our system, a reset link has been sent.</Alert>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Field label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
          <PrimaryButton type="submit" isLoading={isSubmitting}>Send reset link</PrimaryButton>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        <Link to="/login" className="font-medium text-brand-600 hover:underline">
          Back to login
        </Link>
      </p>
    </AuthCard>
  );
}
