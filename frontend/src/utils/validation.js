/**
 * Client-side form validation.
 * Messages mirror the backend express-validator rules exactly,
 * so users see the same text whichever side catches the problem first.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validateName = (value) => {
  const v = (value || "").trim();
  if (!v) return "Name is required";
  if (v.length < 2) return "Name must be at least 2 characters";
  if (v.length > 60) return "Name must be 60 characters or fewer";
  return "";
};

export const validateEmail = (value) => {
  const v = (value || "").trim();
  if (!v) return "Email is required";
  if (!EMAIL_RE.test(v)) return "Enter a valid email address";
  return "";
};

export const validatePassword = (value) => {
  if (!value) return "Password is required";
  if (value.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Za-z]/.test(value)) return "Password must contain at least one letter";
  if (!/\d/.test(value)) return "Password must contain at least one number";
  return "";
};

export const validatePasswordConfirmation = (value, password) => {
  if (!value) return "Please confirm your password";
  if (value !== password) return "Passwords do not match";
  return "";
};

/** Drop empty entries so only real problems remain. */
const compact = (errors) =>
  Object.fromEntries(Object.entries(errors).filter(([, msg]) => Boolean(msg)));

export const validateLoginForm = ({ email, password }) =>
  compact({
    email: validateEmail(email),
    // Login only requires the field — policy checks belong to signup.
    password: password ? "" : "Password is required",
  });

export const validateSignupForm = ({ name, email, password, confirm }) =>
  compact({
    name: validateName(name),
    email: validateEmail(email),
    password: validatePassword(password),
    confirm: validatePasswordConfirmation(confirm, password),
  });

export const validateForgotForm = ({ email }) =>
  compact({ email: validateEmail(email) });

export const validateResetForm = ({ password, confirm }) =>
  compact({
    password: validatePassword(password),
    confirm: validatePasswordConfirmation(confirm, password),
  });

/** Network failures (backend not running) get a friendly message. */
export const friendlyError = (error, fallback = "Something went wrong. Please try again.") => {
  if (!error.response) {
    if (error.request) {
      return "Can’t reach the server. Make sure the backend is running on port 4000.";
    }
    return fallback;
  }
  return error.response.data?.message || fallback;
};
