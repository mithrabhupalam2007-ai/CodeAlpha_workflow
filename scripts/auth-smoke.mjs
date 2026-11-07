#!/usr/bin/env node
/**
 * WorkFlow auth smoke test.
 *
 * Exercises registration, login, logout, refresh, forgot/reset password,
 * CSRF protection, and unauthorized access — and asserts that password
 * hashes are never exposed.
 *
 * Usage:
 *   node scripts/auth-smoke.mjs                       # direct:    http://localhost:4000/api
 *   API_URL=http://localhost:5173 node scripts/auth-smoke.mjs   # through the Vite proxy
 *
 * Run with the backend (and optionally frontend) dev servers started.
 */

const BASE = process.env.API_URL || "http://localhost:4000";
const PREFIX = process.env.PREFIX ?? "/api";

const stamp = Date.now();
const TEST_USER = {
  name: "Test User",
  email: `smoke-${stamp}@workflow.test`,
  password: "Passw0rd123",
  newPassword: "NewPassw0rd456",
};

let passed = 0;
let failed = 0;

const ok = (label, detail = "") => {
  passed += 1;
  console.log(`  ✅ ${label}${detail ? ` — ${detail}` : ""}`);
};

const fail = (label, detail = "") => {
  failed += 1;
  console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
};

const check = (cond, label, detail) => (cond ? ok(label, detail) : fail(label, detail));

// ---------- tiny cookie jar ----------
const newJar = () => new Map();

const cookieHeader = (jar) =>
  [...jar.entries()]
    .filter(([k]) => !k.startsWith("__attrs__"))
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");

function absorbCookies(jar, res) {
  const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  for (const raw of setCookies) {
    const [pair] = raw.split(";");
    const eq = pair.indexOf("=");
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (value === "") jar.delete(name); // clearCookie
    else jar.set(name, value);
    jar.set(`__attrs__${name}`, raw); // keep raw for flag assertions
  }
}

async function request(jar, method, path, body, extraHeaders = {}) {
  const headers = { "Content-Type": "application/json", ...extraHeaders };
  const cookie = cookieHeader(jar);
  if (cookie) headers.Cookie = cookie;

  const res = await fetch(`${BASE}${PREFIX}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (jar) absorbCookies(jar, res);

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* no body */
  }
  return { status: res.status, data, raw: res };
}

const csrfHeader = (jar) => ({ "X-CSRF-Token": jar.get("wf_csrf") });

const bodyHasPassword = (data) =>
  data && JSON.stringify(data).toLowerCase().includes("password");

// ============================================================
(async () => {
  console.log(`\n🔐 WorkFlow auth smoke test → ${BASE}${PREFIX}\n`);

  const jar = newJar();

  // 1. CSRF token issuance
  console.log("1) CSRF token");
  const csrf = await request(jar, "GET", "/auth/csrf");
  check(csrf.status === 200 && csrf.data?.csrfToken, "GET /auth/csrf issues token");
  check(
    (jar.get("__attrs__wf_csrf") || "").includes("HttpOnly") === false,
    "CSRF cookie is readable by JS (not HttpOnly)"
  );

  // 2. State-changing request without CSRF header is rejected
  console.log("2) CSRF enforcement");
  const noCsrf = await request(jar, "POST", "/auth/login", {
    email: TEST_USER.email,
    password: TEST_USER.password,
  });
  check(noCsrf.status === 403, "POST without X-CSRF-Token → 403", `got ${noCsrf.status}`);

  // 3. Registration
  console.log("3) Registration");
  const signup = await request(jar, "POST", "/auth/signup", TEST_USER, csrfHeader(jar));
  check(signup.status === 201, "POST /auth/signup → 201", `got ${signup.status}`);
  check(
    signup.data?.user?.email === TEST_USER.email && !("password" in (signup.data.user || {})),
    "response contains user WITHOUT password field"
  );
  const rawSetCookie = `${jar.get("__attrs__wf_at") || ""}; ${jar.get("__attrs__wf_rt") || ""}`;
  check(rawSetCookie.includes("HttpOnly"), "access + refresh cookies are HttpOnly");
  check(rawSetCookie.includes("SameSite=Lax"), "cookies use SameSite=Lax (dev)");
  check(Boolean(jar.get("wf_at")) && Boolean(jar.get("wf_rt")), "both auth cookies stored");

  // 4. Duplicate registration
  const dup = await request(jar, "POST", "/auth/signup", TEST_USER, csrfHeader(jar));
  check(dup.status === 409, "duplicate email → 409", `got ${dup.status}`);
  check(
    !bodyHasPassword(dup.data),
    "error response leaks no password data"
  );

  // 5. Login failures are generic
  console.log("4) Login");
  const wrongPw = await request(jar, "POST", "/auth/login", {
    email: TEST_USER.email,
    password: "definitely-wrong",
  }, csrfHeader(jar));
  check(wrongPw.status === 401, "wrong password → 401", `got ${wrongPw.status}`);
  check(
    wrongPw.data?.message === "Invalid email or password.",
    "generic error message (no user enumeration)"
  );

  const noUser = await request(jar, "POST", "/auth/login", {
    email: `nobody-${stamp}@workflow.test`,
    password: "whatever123",
  }, csrfHeader(jar));
  check(
    noUser.status === 401 && noUser.data?.message === "Invalid email or password.",
    "unknown email → same generic 401 message"
  );

  // Fresh session for the remaining tests
  const loginJar = newJar();
  const loginCsrf = await request(loginJar, "GET", "/auth/csrf");
  const login = await request(loginJar, "POST", "/auth/login", {
    email: TEST_USER.email,
    password: TEST_USER.password,
  }, { "X-CSRF-Token": loginCsrf.data.csrfToken });
  check(login.status === 200 && login.data?.user?.email === TEST_USER.email,
    "correct credentials → 200 + user", `got ${login.status}`);
  check(!bodyHasPassword(login.data), "login response has no password field");

  // 6. Protected route: /auth/me
  console.log("5) Protected routes");
  const me = await request(loginJar, "GET", "/auth/me");
  check(me.status === 200 && me.data?.user?.id, "authenticated GET /auth/me → 200");
  check(!bodyHasPassword(me.data), "/auth/me response has no password field");

  const noCookieJar = newJar();
  const meAnon = await request(noCookieJar, "GET", "/auth/me");
  check(meAnon.status === 401, "GET /auth/me without cookies → 401", `got ${meAnon.status}`);

  const tamperedJar = newJar();
  tamperedJar.set("wf_at", `${loginJar.get("wf_at")}.tampered`);
  const meTampered = await request(tamperedJar, "GET", "/auth/me");
  check(meTampered.status === 401, "GET /auth/me with tampered token → 401", `got ${meTampered.status}`);

  // 7. Refresh flow
  console.log("6) Token refresh");
  const refresh = await request(loginJar, "POST", "/auth/refresh", undefined,
    { "X-CSRF-Token": loginJar.get("wf_csrf") });
  check(refresh.status === 200, "POST /auth/refresh → 200 (rotates pair)", `got ${refresh.status}`);
  const meAfterRefresh = await request(loginJar, "GET", "/auth/me");
  check(meAfterRefresh.status === 200, "session works after rotation");

  const refreshAnon = await request(newJar(), "POST", "/auth/refresh", undefined,
    { "X-CSRF-Token": "not-a-real-token" });
  check(refreshAnon.status === 403 || refreshAnon.status === 401,
    "refresh without session → 401/403", `got ${refreshAnon.status}`);

  // 8. Forgot password (dev mode: link returned, no SMTP)
  console.log("7) Forgot / reset password");
  const anonJar = newJar();
  const anonCsrf = await request(anonJar, "GET", "/auth/csrf");
  const forgotUnknown = await request(anonJar, "POST", "/auth/forgot-password",
    { email: `nobody-${stamp}@workflow.test` },
    { "X-CSRF-Token": anonCsrf.data.csrfToken });
  check(
    forgotUnknown.status === 200 && !forgotUnknown.data?.devResetUrl,
    "unknown email → generic 200, no reset link leaked"
  );

  const forgotJar = newJar();
  await request(forgotJar, "GET", "/auth/csrf");
  const forgot = await request(forgotJar, "POST", "/auth/forgot-password",
    { email: TEST_USER.email }, { "X-CSRF-Token": forgotJar.get("wf_csrf") });
  check(forgot.status === 200 && forgot.data?.devResetUrl,
    "known email → 200 with dev reset link");

  const resetToken = forgot.data?.devResetUrl?.split("token=")[1];

  const badReset = await request(forgotJar, "POST", "/auth/reset-password",
    { token: "deadbeef".repeat(8), password: TEST_USER.newPassword },
    { "X-CSRF-Token": forgotJar.get("wf_csrf") });
  check(badReset.status === 400, "invalid reset token → 400", `got ${badReset.status}`);

  const goodReset = await request(forgotJar, "POST", "/auth/reset-password",
    { token: resetToken, password: TEST_USER.newPassword },
    { "X-CSRF-Token": forgotJar.get("wf_csrf") });
  check(goodReset.status === 200, "valid reset token → 200", `got ${goodReset.status}`);

  // Reuse of a single-use token must fail
  const reuse = await request(forgotJar, "POST", "/auth/reset-password",
    { token: resetToken, password: "Another12345" },
    { "X-CSRF-Token": forgotJar.get("wf_csrf") });
  check(reuse.status === 400, "reset token is single-use (reuse → 400)");

  // Old password dead, new password works
  const oldLogin = await request(newJar(), "GET", "/auth/csrf");
  const oldPwLogin = await request(oldJarFor(oldLogin), "POST", "/auth/login", {
    email: TEST_USER.email,
    password: TEST_USER.password,
  }, { "X-CSRF-Token": oldLogin.data.csrfToken });
  check(oldPwLogin.status === 401, "old password after reset → 401", `got ${oldPwLogin.status}`);

  const newJar2 = newJar();
  const newCsrf = await request(newJar2, "GET", "/auth/csrf");
  const newPwLogin = await request(newJar2, "POST", "/auth/login", {
    email: TEST_USER.email,
    password: TEST_USER.newPassword,
  }, { "X-CSRF-Token": newCsrf.data.csrfToken });
  check(newPwLogin.status === 200, "new password after reset → 200", `got ${newPwLogin.status}`);

  // 9. Logout
  console.log("8) Logout");
  const logout = await request(newJar2, "POST", "/auth/logout", undefined,
    { "X-CSRF-Token": newJar2.get("wf_csrf") });
  check(logout.status === 200, "POST /auth/logout → 200", `got ${logout.status}`);
  check(
    !newJar2.get("wf_at") && !newJar2.get("wf_rt"),
    "auth cookies cleared after logout"
  );
  const meAfterLogout = await request(newJar2, "GET", "/auth/me");
  check(meAfterLogout.status === 401, "GET /auth/me after logout → 401", `got ${meAfterLogout.status}`);

  // 10. Validation errors
  console.log("9) Validation");
  const vJar = newJar();
  const vCsrf = await request(vJar, "GET", "/auth/csrf");
  const invalid = await request(vJar, "POST", "/auth/signup",
    { name: "", email: "not-an-email", password: "short" },
    { "X-CSRF-Token": vCsrf.data.csrfToken });
  check(
    invalid.status === 400 && invalid.data?.errors?.email && invalid.data?.errors?.password,
    "invalid signup → 400 with per-field messages"
  );

  // ---------- Summary ----------
  const total = passed + failed;
  console.log(`\n──────────────────────────────────────`);
  console.log(`  ${passed}/${total} checks passed${failed ? `, ${failed} FAILED` : " 🎉"}`);
  console.log(`──────────────────────────────────────\n`);
  process.exit(failed ? 1 : 0);
})().catch((error) => {
  console.error("\n💥 Smoke test crashed:", error.message);
  process.exit(1);
});

/** Helper: request() needs a jar argument — small wrapper for the old-password login. */
function oldJarFor(csrfResult) {
  const j = newJar();
  j.set("wf_csrf", csrfResult.data.csrfToken);
  return j;
}
