import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import Alert from "../../components/ui/Alert.jsx";
import Button from "../../components/ui/Button.jsx";
import FormInput from "../../components/ui/FormInput.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  friendlyError,
  validateResetForm,
} from "../../utils/validation.js";
import AuthLayout from "./AuthLayout.jsx";

export default function ResetPassword() {
  const { resetPassword } = useAuth();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [form, setForm] = useState({ password: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const update = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const validation = validateResetForm(form);
    setErrors(validation);
    setServerError(null);
    if (Object.keys(validation).length > 0) return;

    setLoading(true);
    try {
      await resetPassword(token, form.password);
      setDone(true);
    } catch (error) {
      const data = error.response?.data;
      setServerError(friendlyError(error));
      if (data?.errors) setErrors((prev) => ({ ...prev, ...data.errors }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="rounded-panel border border-slate-200/70 bg-surface p-6 shadow-card sm:p-8">
        {done ? (
          <div className="space-y-5 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-glow">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-7 w-7 text-white"
                aria-hidden="true"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>

            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">
                Password updated
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Your password has been changed and all existing sessions were
                signed out. Log in with your new password.
              </p>
            </div>

            <Link to="/login">
              <Button className="w-full">Continue to log in</Button>
            </Link>
          </div>
        ) : !token ? (
          <div className="space-y-5 text-center">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">
                Invalid reset link
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                This page needs a reset token. Request a new link and use it
                directly from your email.
              </p>
            </div>
            <Link to="/forgot-password">
              <Button className="w-full">Request a new link</Button>
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="text-xl font-bold tracking-tight text-slate-900">
                Set a new password
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Your link is single-use and expires 10 minutes after it was
                requested.
              </p>
            </div>

            {serverError ? (
              <Alert variant="error" className="mb-5">
                {serverError}
              </Alert>
            ) : null}

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <FormInput
                label="New password"
                type="password"
                required
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={form.password}
                onChange={update("password")}
                error={errors.password}
                disabled={loading}
              />

              <FormInput
                label="Confirm new password"
                type="password"
                required
                autoComplete="new-password"
                placeholder="Repeat your new password"
                value={form.confirm}
                onChange={update("confirm")}
                error={errors.confirm}
                disabled={loading}
              />

              <Button type="submit" loading={loading} className="w-full">
                {loading ? "Updating…" : "Update password"}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-500">
              Remembered it?{" "}
              <Link
                to="/login"
                className="font-semibold text-brand-600 transition-colors hover:text-brand-700"
              >
                Back to log in
              </Link>
            </p>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
