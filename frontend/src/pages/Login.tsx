import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "../context/AuthContext";
import { AuthCard } from "../components/AuthCard";
import { Field, PasswordField, PrimaryButton, Alert } from "../components/FormControls";
import { roleHomePath } from "../routes/roleHomePath";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});
type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      const user = await login(values.email, values.password);
      const redirectTo = (location.state as any)?.from?.pathname ?? roleHomePath(user.role);
      navigate(redirectTo, { replace: true });
    } catch (err: any) {
      if (err?.code === "ACCOUNT_LOCKED") setServerError("Account temporarily locked due to failed attempts.");
      else if (err?.code === "ACCOUNT_INACTIVE") setServerError("Your account is inactive. Contact your administrator.");
      else if (err?.code === "TEMP_PASSWORD_EXPIRED")
        setServerError("Your temporary password has expired. Use 'Forgot password' below, or ask your administrator to resend your invite.");
      else setServerError(err?.message ?? "Invalid email or password");
    }
  };

  return (
    <AuthCard title="Welcome back" subtitle="Sign in to your HMS account">
      {serverError && <Alert>{serverError}</Alert>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
        <PasswordField label="Password" autoComplete="current-password" error={errors.password?.message} {...register("password")} />
        <div className="mb-4 text-right">
          <Link to="/forgot-password" className="text-sm text-brand-600 hover:underline">
            Forgot password?
          </Link>
        </div>
        <PrimaryButton type="submit" isLoading={isSubmitting}>Sign in</PrimaryButton>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        Don't have an account? Ask your hospital administrator to invite you.
      </p>
    </AuthCard>
  );
}