import { Link } from "react-router-dom";

export function UnauthorizedPage() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 text-center">
      <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">403</h1>
      <p className="text-slate-500 dark:text-slate-400">You don't have permission to view this page.</p>
      <Link to="/dashboard" className="text-brand-600 hover:underline">Back to dashboard</Link>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 text-center">
      <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">404</h1>
      <p className="text-slate-500 dark:text-slate-400">Page not found.</p>
      <Link to="/" className="text-brand-600 hover:underline">Go home</Link>
    </div>
  );
}
