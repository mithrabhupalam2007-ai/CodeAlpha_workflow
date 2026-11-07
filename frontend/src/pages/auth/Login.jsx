import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import Alert from "../../components/ui/Alert.jsx";
import Button from "../../components/ui/Button.jsx";
import FormInput from "../../components/ui/FormInput.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  friendlyError,
  validateLoginForm,
} from "../../utils/validation.js";
import AuthLayout from "./AuthLayout.jsx";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/";

  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [loading, setLoading] = useState(false);

  const update = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const validation = validateLoginForm(form);
    setErrors(validation);
    setServerError(null);
    if (Object.keys(validation).length > 0) return;

    setLoading(true);
    try {
      await login(form.email.trim(), form.password);
      navigate(from, { replace: true });
    } catch (error) {
      // Banner only — server field errors for login duplicate the banner text.
      setServerError(friendlyError(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="rounded-panel border border-slate-200/70 bg-surface p-6 shadow-card sm:p-8">
        <div className="mb-6">
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Welcome back
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Log in to continue to your workspace.
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
            value={form.email}
            onChange={update("email")}
            error={errors.email}
            disabled={loading}
          />

          <FormInput
            label="Password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            value={form.password}
            onChange={update("password")}
            error={errors.password}
            disabled={loading}
          />

          <div className="flex justify-end">
            <Link
              to="/forgot-password"
              className="text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
            >
              Forgot password?
            </Link>
          </div>

          <Button type="submit" loading={loading} className="w-full">
            {loading ? "Logging in…" : "Log in"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Don’t have an account?{" "}
          <Link
            to="/signup"
            className="font-semibold text-brand-600 transition-colors hover:text-brand-700"
          >
            Sign up free
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
