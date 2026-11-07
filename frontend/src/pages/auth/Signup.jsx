import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import Alert from "../../components/ui/Alert.jsx";
import Button from "../../components/ui/Button.jsx";
import FormInput from "../../components/ui/FormInput.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  friendlyError,
  validateSignupForm,
} from "../../utils/validation.js";
import AuthLayout from "./AuthLayout.jsx";

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [loading, setLoading] = useState(false);

  const update = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const validation = validateSignupForm(form);
    setErrors(validation);
    setServerError(null);
    if (Object.keys(validation).length > 0) return;

    setLoading(true);
    try {
      await signup({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      navigate("/", { replace: true }); // signup logs you straight in
    } catch (error) {
      const data = error.response?.data;
      setServerError(friendlyError(error));
      if (data?.errors) {
        setErrors((prev) => ({ ...prev, ...data.errors }));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="rounded-panel border border-slate-200/70 bg-surface p-6 shadow-card sm:p-8">
        <div className="mb-6">
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Create your account
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Free to start — your workspace takes a second to set up.
          </p>
        </div>

        {serverError ? (
          <Alert variant="error" className="mb-5">
            {serverError}
          </Alert>
        ) : null}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <FormInput
            label="Full name"
            required
            autoComplete="name"
            placeholder="Ada Lovelace"
            value={form.name}
            onChange={update("name")}
            error={errors.name}
            disabled={loading}
          />

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
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={form.password}
            onChange={update("password")}
            error={errors.password}
            disabled={loading}
          />

          <FormInput
            label="Confirm password"
            type="password"
            required
            autoComplete="new-password"
            placeholder="Repeat your password"
            value={form.confirm}
            onChange={update("confirm")}
            error={errors.confirm}
            disabled={loading}
          />

          <p className="text-xs leading-relaxed text-slate-400">
            Passwords need 8+ characters with at least one letter and one
            number. We hash them with bcrypt — plaintext never touches the
            database.
          </p>

          <Button type="submit" loading={loading} className="w-full">
            {loading ? "Creating account…" : "Create account"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-semibold text-brand-600 transition-colors hover:text-brand-700"
          >
            Log in
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
