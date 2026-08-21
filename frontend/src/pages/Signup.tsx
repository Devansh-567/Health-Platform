import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  .object({
    firstName: z.string().min(1, "Required"),
    lastName: z.string().min(1, "Required"),
    email: z.string().email("Enter a valid email"),
    phone: z.string().optional(),
    password: passwordRule,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, { message: "Passwords do not match", path: ["confirmPassword"] });

type FormValues = z.infer<typeof schema>;

export default function SignupPage() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      await authApi.signup({
        email: values.email,
        password: values.password,
        firstName: values.firstName,
        lastName: values.lastName,
        phone: values.phone || undefined,
      });
      setSuccess(true);
    } catch (err: any) {
      setServerError(err?.message ?? "Signup failed. Please try again.");
    }
  };

  if (success) {
    return (
      <AuthCard title="Check your email" subtitle="We sent you a verification link">
        <Alert variant="success">
          Your account was created. Please verify your email before logging in.
        </Alert>
        <PrimaryButton onClick={() => navigate("/login")}>Go to login</PrimaryButton>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Create your account" subtitle="Patient registration">
      {serverError && <Alert>{serverError}</Alert>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" error={errors.firstName?.message} {...register("firstName")} />
          <Field label="Last name" error={errors.lastName?.message} {...register("lastName")} />
        </div>
        <Field label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
        <Field label="Phone (optional)" type="tel" error={errors.phone?.message} {...register("phone")} />
        <PasswordField label="Password" autoComplete="new-password" error={errors.password?.message} {...register("password")} />
        <PasswordField label="Confirm password" autoComplete="new-password" error={errors.confirmPassword?.message} {...register("confirmPassword")} />
        <PrimaryButton type="submit" isLoading={isSubmitting}>Create account</PrimaryButton>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-brand-600 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}