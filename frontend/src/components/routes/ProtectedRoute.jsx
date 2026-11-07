import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../../context/AuthContext.jsx";
import Spinner from "../ui/Spinner.jsx";

/** Full-page loader shown while the session is being resolved. */
export function FullScreenLoader({ label = "Loading…" }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-canvas">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 shadow-glow">
        <Spinner className="h-6 w-6 text-white" />
      </span>
      <p className="text-sm font-medium text-slate-500">{label}</p>
    </div>
  );
}

/**
 * Wraps protected pages — unauthenticated visitors are redirected to
 * /login with the attempted location saved in router state.
 */
export function ProtectedRoute({ children }) {
  const { user, initializing } = useAuth();
  const location = useLocation();

  if (initializing) return <FullScreenLoader label="Loading your workspace…" />;

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  return children ?? <Outlet />;
}

/**
 * Wraps /login and /signup — already-authenticated users are sent
 * back to where they came from (or the dashboard).
 */
export function GuestRoute({ children }) {
  const { user, initializing } = useAuth();
  const location = useLocation();

  if (initializing) return <FullScreenLoader />;

  if (user) {
    const from = location.state?.from;
    const safeFrom =
      from && !from.startsWith("/login") && !from.startsWith("/signup")
        ? from
        : "/";
    return <Navigate to={safeFrom} replace />;
  }

  return children ?? <Outlet />;
}

export default ProtectedRoute;
