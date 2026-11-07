import axios from "axios";

/**
 * Shared axios instance.
 *
 * - Cookies: `withCredentials` so the HTTP-only JWT cookies (wf_at / wf_rt)
 *   travel with every request. In dev the Vite proxy makes it all same-origin.
 * - CSRF: every POST/PUT/PATCH/DELETE echoes the JS-readable `wf_csrf` cookie
 *   in the X-CSRF-Token header (double-submit pattern; see backend csrf.js).
 * - Silent refresh: on a 401 the client refreshes the token pair once and
 *   retries the original request. Auth endpoints are excluded to avoid loops.
 */

const CSRF_COOKIE = "wf_csrf";
const CSRF_HEADER = "X-CSRF-Token";

const AUTH_ENDPOINTS = [
  "/auth/login",
  "/auth/signup",
  "/auth/refresh",
  "/auth/logout",
  "/auth/forgot-password",
  "/auth/reset-password",
];

/** Read a cookie value by name (works because wf_csrf is not HTTP-only). */
export const readCookie = (name) =>
  document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1];

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  timeout: 15000,
  withCredentials: true, // required for cookie-based auth
  headers: { "Content-Type": "application/json" },
});

// ---------- Request: attach CSRF token to mutations ----------
apiClient.interceptors.request.use((config) => {
  const method = (config.method || "get").toLowerCase();
  if (["post", "put", "patch", "delete"].includes(method)) {
    const token = readCookie(CSRF_COOKIE);
    if (token && !config.headers[CSRF_HEADER]) {
      config.headers[CSRF_HEADER] = token;
    }
  }
  return config;
});

// ---------- Response: silent refresh on expired access token ----------
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config || {};
    const status = error.response?.status;
    const url = config.url || "";
    const isAuthCall = AUTH_ENDPOINTS.some((endpoint) => url.includes(endpoint));

    if (status === 401 && !config._retried && !isAuthCall) {
      config._retried = true;
      try {
        await apiClient.post("/auth/refresh"); // rotates cookies
        return apiClient(config); // retry with the fresh cookie
      } catch {
        return Promise.reject(error); // no active session — caller handles it
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
