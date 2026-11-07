import { useState } from "react";
import { Link } from "react-router-dom";

import Alert from "../../components/ui/Alert.jsx";
import Button from "../../components/ui/Button.jsx";
import FormInput from "../../components/ui/FormInput.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  friendlyError,
  validateForgotForm,
} from "../../utils/validation.js";
import AuthLayout from "./AuthLayout.jsx";

export default function ForgotPassword() {
  const { forgotPassword } = useAuth();

  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(null); // { message, devResetUrl? }

  const handleSubmit = async (event) => {
    event.preventDefault();

    const validation = validateForgotForm({ email });
    setErrors(validation);
    setServerError(null);
    if (Object.keys(validation).length > 0) return;

    setLoading(true);
    try {
      const data = await forgotPassword(email.trim());
      setSent(data);
    } catch (error) {
      setServerError(friendlyError(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="rounded-panel border border-slate-200/70 bg-surface p-6 shadow-card sm:p-8">
        {!sent ? (
          <>
            <div className="mb-6">
              <h2 className="text-xl font-bold tracking-tight text-slate-900">
                Forgot your password?
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">
                Enter the email you signed up with and we’ll send you a reset
                link valid for 10 minutes.
              </p>
            </div>

            {serverError ? (
              <Alert variant="error" className="mb-5">
                {serverError}
              </Alert>
            ) : null}

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <FormInput
                label="Email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setErrors({});
                }}
                error={errors.email}
                disabled={loading}
              />

              <Button type="submit" loading={loading} className="w-full">
                {loading ? "Sending link…" : "Send reset link"}
              </Button>
            </form>
          </>
        ) : (
          <div className="space-y-5 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-glow">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-7 w-7 text-white"
                aria-hidden="true"
              >
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </span>

            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">
                Check your inbox
              </h2>
              <p className="mt-1 text-sm text-slate-500">{sent.message}</p>
            </div>

            {sent.devResetUrl ? (
              <Alert variant="info" title="Dev mode (no SMTP configured)" className="text-left">
                <p className="mb-2">
                  No mail server is running, so the link is shown here instead:
                </p>
                <a
                  href={sent.devResetUrl}
                  className="break-all font-semibold text-accent-700 underline underline-offset-2"
                >
                  {sent.devResetUrl}
                </a>
              </Alert>
            ) : null}

            <div className="flex flex-col gap-3">
              <Link to="/login">
                <Button variant="ghost" className="w-full">
                  Back to log in
                </Button>
              </Link>
              <button
                type="button"
                onClick={() => setSent(null)}
                className="text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
              >
                Try another email
              </button>
            </div>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
