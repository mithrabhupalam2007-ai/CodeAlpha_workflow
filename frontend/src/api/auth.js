import apiClient from "./client.js";

const data = async (promise) => (await promise).data;

/** GET /api/auth/csrf — must run before any state-changing request. */
export const getCsrfToken = () => data(apiClient.get("/auth/csrf"));

/** POST /api/auth/signup — creates the account and logs the user in. */
export const signup = ({ name, email, password }) =>
  data(apiClient.post("/auth/signup", { name, email, password }));

/** POST /api/auth/login */
export const login = (email, password) =>
  data(apiClient.post("/auth/login", { email, password }));

/** POST /api/auth/logout — clears the HTTP-only cookies */
export const logout = () => data(apiClient.post("/auth/logout"));

/** GET /api/auth/me — current session (401 when logged out) */
export const me = () => data(apiClient.get("/auth/me"));

/** POST /api/auth/refresh — rotates the token pair (also runs automatically on 401) */
export const refresh = () => data(apiClient.post("/auth/refresh"));

/** POST /api/auth/forgot-password */
export const forgotPassword = (email) =>
  data(apiClient.post("/auth/forgot-password", { email }));

/** POST /api/auth/reset-password */
export const resetPassword = (token, password) =>
  data(apiClient.post("/auth/reset-password", { token, password }));
