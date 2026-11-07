import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import * as authApi from "../api/auth.js";

const AuthContext = createContext(null);

/**
 * Application-wide authentication state.
 *
 * On boot it fetches the CSRF cookie, then hydrates the session from
 * GET /api/auth/me using the HTTP-only JWT cookies. The actual tokens
 * are never readable by JavaScript.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        await authApi.getCsrfToken(); // needed before the first mutation
        const data = await authApi.me();
        if (active) setUser(data.user);
      } catch {
        if (active) setUser(null); // not logged in (or backend unreachable)
      } finally {
        if (active) setInitializing(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await authApi.login(email, password);
    setUser(data.user);
    return data.user;
  }, []);

  const signup = useCallback(async ({ name, email, password }) => {
    const data = await authApi.signup({ name, email, password });
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const forgotPassword = useCallback(
    (email) => authApi.forgotPassword(email),
    []
  );

  const resetPassword = useCallback(
    (token, password) => authApi.resetPassword(token, password),
    []
  );

  const value = useMemo(
    () => ({
      user,
      initializing,
      isAuthenticated: Boolean(user),
      login,
      signup,
      logout,
      forgotPassword,
      resetPassword,
    }),
    [user, initializing, login, signup, logout, forgotPassword, resetPassword]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an <AuthProvider>");
  return ctx;
}

export default AuthContext;
