import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { authApi } from "../api/auth.api";
import { AuthCard } from "../components/AuthCard";
import { Alert } from "../components/FormControls";
import { FullscreenLoader } from "../routes/ProtectedRoute";

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Verification link is missing a token.");
      return;
    }
    authApi
      .verifyEmail(token)
      .then((res) => {
        setStatus("success");
        setMessage(res.message ?? "Email verified successfully.");
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err?.message ?? "This verification link is invalid or expired.");
      });
  }, [token]);

  if (status === "loading") return <FullscreenLoader />;

  return (
    <AuthCard title="Email verification">
      <Alert variant={status === "success" ? "success" : "error"}>{message}</Alert>
      <Link to="/login" className="text-sm font-medium text-brand-600 hover:underline">
        Go to login
      </Link>
    </AuthCard>
  );
}
