#!/usr/bin/env node
/**
 * WorkFlow project-management smoke test.
 *
 * Covers: project CRUD, archive/restore, search-list integrity, invitations
 * (invite / accept / decline / revoke), member removal, role assignment,
 * permission enforcement (owner vs admin vs editor vs viewer vs non-member),
 * and private-data isolation.
 *
 * Usage:
 *   node scripts/project-smoke.mjs                          # direct:  http://localhost:4000/api
 *   API_URL=http://localhost:5173 node scripts/project-smoke.mjs   # via Vite proxy
 *
 * Requires the backend running and seeded demo data:
 *   cd backend && npm run seed -- --reset
 *   demo@workflow.app / Demo@1234   (owner)
 *   aisha@workflow.app / Team mate@123  (teammate)
 *   rahul@workflow.app / Team mate@123  (teammate)
 *   sarah@workflow.app / Team mate@123  (teammate)
 */

const BASE = process.env.API_URL || "http://localhost:4000";
const PREFIX = process.env.PREFIX ?? "/api";

const OWNER = { email: "demo@workflow.app", password: "Demo@1234" };
const AISHA = { email: "aisha@workflow.app", password: "Teammate@123" };
const RAHUL = { email: "rahul@workflow.app", password: "Teammate@123" };
const SARAH = { email: "sarah@workflow.app", password: "Teammate@123" };

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
    if (value === "") jar.delete(name);
    else jar.set(name, value);
    jar.set(`__attrs__${name}`, raw);
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
  absorbCookies(jar, res);

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* no body */
  }
  return { status: res.status, data };
}

const csrfHeader = (jar) => ({ "X-CSRF-Token": jar.get("wf_csrf") });

async function login({ email, password }) {
  const jar = newJar();
  await request(jar, "GET", "/auth/csrf");
  const res = await request(
    jar,
    "POST",
    "/auth/login",
    { email, password },
    csrfHeader(jar)
  );
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status}`);
  return jar;
}

// ============================================================
(async () => {
  console.log(`\n📁 WorkFlow project smoke test → ${BASE}${PREFIX}\n`);

  const owner = await login(OWNER);
  const aisha = await login(AISHA);
  const rahul = await login(RAHUL);
  const sarah = await login(SARAH);
  ok("logged in as owner, aisha, rahul, sarah");

  // ---------- 1. create ----------
  console.log("1) Create project");
  const created = await request(
    owner,
    "POST",
    "/projects",
    {
      name: "Smoke Test Project",
      description: "Created by project-smoke.mjs",
      color: "rose",
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
    },
    csrfHeader(owner)
  );
  check(created.status === 201, "POST /projects → 201", `got ${created.status}`);
  const pid = created.data?.project?.id;
  check(Boolean(pid), "response contains project id");
  check(created.data?.project?.myRole === "owner", "creator myRole = owner");
  check(
    created.data?.project?.members?.[0]?.role === "owner",
    "first member is owner with role owner"
  );

  const invalid = await request(
    owner,
    "POST",
    "/projects",
    { name: "x" },
    csrfHeader(owner)
  );
  check(invalid.status === 400, "invalid name → 400 with field errors", `got ${invalid.status}`);

  // ---------- 2. list ----------
  console.log("2) List projects");
  const list = await request(owner, "GET", "/projects");
  const inList = (list.data?.projects || []).find((p) => p.id === pid);
  check(list.status === 200 && list.data?.count >= 6, "GET /projects → 200 with seeded + new", `count ${list.data?.count}`);
  check(Boolean(inList), "new project appears in the list");
  check(
    (list.data?.projects || []).some((p) => p.name === "Website Redesign" && p.progress === 63),
    "seeded project keeps real progress (63%)"
  );
  check(
    inList?.members?.[0]?.name === "Demo User",
    "members are populated with names + roles"
  );

  // ---------- 3. detail ----------
  console.log("3) Project detail");
  const detail = await request(owner, "GET", `/projects/${pid}`);
  check(detail.status === 200, "GET /projects/:id → 200", `got ${detail.status}`);
  check(detail.data?.project?.myRole === "owner", "myRole reported");

  // ---------- 4. edit (owner) ----------
  console.log("4) Edit project");
  const edited = await request(
    owner,
    "PATCH",
    `/projects/${pid}`,
    { name: "Smoke Test Project v2", color: "sky", description: "Updated by smoke test" },
    csrfHeader(owner)
  );
  check(edited.status === 200, "owner PATCH → 200", `got ${edited.status}`);
  check(
    edited.data?.project?.name === "Smoke Test Project v2" &&
      edited.data?.project?.color === "sky",
    "changes applied"
  );

  // ---------- 5. invitations ----------
  console.log("5) Invitations");
  const invite = await request(
    owner,
    "POST",
    "/invitations",
    { projectId: pid, email: AISHA.email, role: "editor" },
    csrfHeader(owner)
  );
  check(invite.status === 201, "invite aisha → 201", `got ${invite.status}`);
  check(invite.data?.invitation?.role === "editor", "invitation role = editor");
  const inviteId = invite.data?.invitation?.id;

  const dup = await request(
    owner,
    "POST",
    "/invitations",
    { projectId: pid, email: AISHA.email, role: "editor" },
    csrfHeader(owner)
  );
  check(dup.status === 200, "duplicate pending invite → refreshed (200)", `got ${dup.status}`);

  const selfInvite = await request(
    owner,
    "POST",
    "/invitations",
    { projectId: pid, email: OWNER.email },
    csrfHeader(owner)
  );
  check(selfInvite.status === 400, "invite yourself → 400", `got ${selfInvite.status}`);

  const aishaMine = await request(aisha, "GET", "/invitations/mine");
  check(
    aishaMine.status === 200 &&
      (aishaMine.data?.invitations || []).some((i) => i.id === inviteId),
    "aisha sees the invitation addressed to her email"
  );

  const sarahMine = await request(sarah, "GET", "/invitations/mine");
  check(
    (sarahMine.data?.invitations || []).every((i) => i.id !== inviteId),
    "sarah does NOT see aisha's invitation (private)"
  );

  const wrongUser = await request(sarah, "POST", `/invitations/${inviteId}/accept`, {}, csrfHeader(sarah));
  check(wrongUser.status === 403, "wrong user accepting → 403", `got ${wrongUser.status}`);

  const declineByAisha = await request(aisha, "POST", `/invitations/${inviteId}/decline`, {}, csrfHeader(aisha));
  check(declineByAisha.status === 200, "aisha can decline (testing decline path)", `got ${declineByAisha.status}`);
  check(
    (await request(aisha, "GET", "/invitations/mine")).data?.invitations?.every((i) => i.id !== inviteId),
    "declined invitation disappears from pending list"
  );

  // re-invite for the accept path
  const invite2 = await request(
    owner,
    "POST",
    "/invitations",
    { projectId: pid, email: AISHA.email, role: "editor" },
    csrfHeader(owner)
  );
  check(invite2.status === 201, "re-invite after decline → 201", `got ${invite2.status}`);
  const invite2Id = invite2.data?.invitation?.id;

  const accepted = await request(aisha, "POST", `/invitations/${invite2Id}/accept`, {}, csrfHeader(aisha));
  check(accepted.status === 200, "aisha accepts → 200", `got ${accepted.status}`);

  // ---------- 6. member access after accept ----------
  console.log("6) Access control");
  const aishaDetail = await request(aisha, "GET", `/projects/${pid}`);
  check(aishaDetail.status === 200, "new member can read the project", `got ${aishaDetail.status}`);
  check(aishaDetail.data?.project?.myRole === "editor", "aisha myRole = editor");

  const sarahDetail = await request(sarah, "GET", `/projects/${pid}`);
  check(sarahDetail.status === 404, "non-member GET detail → 404 (no data leak)", `got ${sarahDetail.status}`);
  const sarahEdit = await request(sarah, "PATCH", `/projects/${pid}`, { name: "Hacked" }, csrfHeader(sarah));
  check(sarahEdit.status === 404, "non-member PATCH → 404", `got ${sarahEdit.status}`);
  const sarahDelete = await request(sarah, "DELETE", `/projects/${pid}`, undefined, csrfHeader(sarah));
  check(sarahDelete.status === 404, "non-member DELETE → 404", `got ${sarahDelete.status}`);
  const sarahArchive = await request(sarah, "POST", `/projects/${pid}/archive`, {}, csrfHeader(sarah));
  check(sarahArchive.status === 404, "non-member archive → 404", `got ${sarahArchive.status}`);
  const sarahList = await request(sarah, "GET", "/projects");
  check(
    !(sarahList.data?.projects || []).some((p) => p.id === pid),
    "non-member never sees the project in lists"
  );

  // ---------- 7. permissions per role ----------
  console.log("7) Role permissions");
  const ownerMemberId = aishaDetail.data.project.members.find((m) => m.role === "owner").id;
  const aishaMemberId = aishaDetail.data.project.members.find((m) => m.email === AISHA.email).id;

  const editorEdit = await request(aisha, "PATCH", `/projects/${pid}`, { name: "Nope" }, csrfHeader(aisha));
  check(editorEdit.status === 403, "editor PATCH settings → 403", `got ${editorEdit.status}`);
  const editorDelete = await request(aisha, "DELETE", `/projects/${pid}`, undefined, csrfHeader(aisha));
  check(editorDelete.status === 403, "editor DELETE → 403", `got ${editorDelete.status}`);
  const editorInvite = await request(
    aisha,
    "POST",
    "/invitations",
    { projectId: pid, email: SARAH.email, role: "viewer" },
    csrfHeader(aisha)
  );
  check(editorInvite.status === 403, "editor invite → 403", `got ${editorInvite.status}`);
  const editorRole = await request(
    aisha,
    "PATCH",
    `/projects/${pid}/members/${aishaMemberId}`,
    { role: "viewer" },
    csrfHeader(aisha)
  );
  check(editorRole.status === 403, "editor assigning roles → 403", `got ${editorRole.status}`);

  // promote aisha to admin
  const promote = await request(
    owner,
    "PATCH",
    `/projects/${pid}/members/${aishaMemberId}`,
    { role: "admin" },
    csrfHeader(owner)
  );
  check(promote.status === 200, "owner promotes aisha to admin → 200", `got ${promote.status}`);

  // admin capabilities: invite + remove editors
  const adminInvite = await request(
    aisha,
    "POST",
    "/invitations",
    { projectId: pid, email: RAHUL.email, role: "viewer" },
    csrfHeader(aisha)
  );
  check(adminInvite.status === 201, "admin invite → 201", `got ${adminInvite.status}`);
  const rahulInviteId = adminInvite.data?.invitation?.id;

  const rahulAccepted = await request(rahul, "POST", `/invitations/${rahulInviteId}/accept`, {}, csrfHeader(rahul));
  check(rahulAccepted.status === 200, "rahul accepts viewer invite → 200", `got ${rahulAccepted.status}`);

  const rahulId = (await request(owner, "GET", `/projects/${pid}`)).data.project.members.find(
    (m) => m.email === RAHUL.email
  ).id;

  const adminRemovesViewer = await request(
    aisha,
    "DELETE",
    `/projects/${pid}/members/${rahulId}`,
    undefined,
    csrfHeader(aisha)
  );
  check(adminRemovesViewer.status === 200, "admin removes a viewer → 200", `got ${adminRemovesViewer.status}`);

  const adminRemovesOwner = await request(
    aisha,
    "DELETE",
    `/projects/${pid}/members/${ownerMemberId}`,
    undefined,
    csrfHeader(aisha)
  );
  check(adminRemovesOwner.status === 403, "admin tries removing the owner → 403", `got ${adminRemovesOwner.status}`);

  const adminAssignsAdmin = await request(
    aisha,
    "PATCH",
    `/projects/${pid}/members/${rahulId}`,
    { role: "admin" },
    csrfHeader(aisha)
  );
  check(adminAssignsAdmin.status === 403, "admin assigning the admin role → 403 (owner only)", `got ${adminAssignsAdmin.status}`);

  // owner's role is immutable
  const changeOwnerRole = await request(
    owner,
    "PATCH",
    `/projects/${pid}/members/${ownerMemberId}`,
    { role: "editor" },
    csrfHeader(owner)
  );
  check(changeOwnerRole.status === 409, "changing the owner's role → 409", `got ${changeOwnerRole.status}`);

  // demote aisha back to viewer: invite power disappears
  await request(owner, "PATCH", `/projects/${pid}/members/${aishaMemberId}`, { role: "viewer" }, csrfHeader(owner));
  const viewerInvite = await request(
    aisha,
    "POST",
    "/invitations",
    { projectId: pid, email: SARAH.email, role: "viewer" },
    csrfHeader(aisha)
  );
  check(viewerInvite.status === 403, "viewer invite after demotion → 403", `got ${viewerInvite.status}`);

  // ---------- 8. decline by the right user ----------
  console.log("8) Decline flow");
  const sarahInvite = await request(
    owner,
    "POST",
    "/invitations",
    { projectId: pid, email: SARAH.email, role: "viewer" },
    csrfHeader(owner)
  );
  check(sarahInvite.status === 201, "invite sarah → 201", `got ${sarahInvite.status}`);
  const sarahDeclines = await request(
    sarah,
    "POST",
    `/invitations/${sarahInvite.data.invitation.id}/decline`,
    {},
    csrfHeader(sarah)
  );
  check(sarahDeclines.status === 200, "sarah declines her invitation → 200", `got ${sarahDeclines.status}`);
  const sarahAfter = await request(sarah, "GET", `/projects/${pid}`);
  check(sarahAfter.status === 404, "declining does not grant access", `got ${sarahAfter.status}`);

  // revoke flow
  const toRevoke = await request(
    owner,
    "POST",
    "/invitations",
    { projectId: pid, email: SARAH.email, role: "viewer" },
    csrfHeader(owner)
  );
  const revoked = await request(
    owner,
    "DELETE",
    `/invitations/${toRevoke.data.invitation.id}`,
    undefined,
    csrfHeader(owner)
  );
  check(revoked.status === 200, "owner revokes an invitation → 200", `got ${revoked.status}`);
  const sarahAcceptRevoked = await request(
    sarah,
    "POST",
    `/invitations/${toRevoke.data.invitation.id}/accept`,
    {},
    csrfHeader(sarah)
  );
  check(sarahAcceptRevoked.status === 409, "accepting a revoked invitation → 409", `got ${sarahAcceptRevoked.status}`);

  // project invitation list permission
  const editorSeesInvites = await request(aisha, "GET", `/invitations?projectId=${pid}`);
  check(editorSeesInvites.status === 403, "viewer can't list project invitations → 403", `got ${editorSeesInvites.status}`);
  const ownerSeesInvites = await request(owner, "GET", `/invitations?projectId=${pid}`);
  check(ownerSeesInvites.status === 200, "owner lists project invitations → 200", `got ${ownerSeesInvites.status}`);

  // ---------- 9. archive / restore ----------
  console.log("9) Archive & restore");
  const archEditor = await request(aisha, "POST", `/projects/${pid}/archive`, {}, csrfHeader(aisha));
  check(archEditor.status === 403, "non-owner can't archive → 403", `got ${archEditor.status}`);
  const archived = await request(owner, "POST", `/projects/${pid}/archive`, {}, csrfHeader(owner));
  check(archived.status === 200 && archived.data?.project?.status === "archived", "owner archives → status archived", `got ${archived.status}`);
  const doubleArchive = await request(owner, "POST", `/projects/${pid}/archive`, {}, csrfHeader(owner));
  check(doubleArchive.status === 409, "archiving twice → 409", `got ${doubleArchive.status}`);
  const editArchived = await request(owner, "PATCH", `/projects/${pid}`, { name: "Nope" }, csrfHeader(owner));
  check(editArchived.status === 409, "editing archived → 409", `got ${editArchived.status}`);
  const inviteArchived = await request(
    owner,
    "POST",
    "/invitations",
    { projectId: pid, email: SARAH.email },
    csrfHeader(owner)
  );
  check(inviteArchived.status === 409, "inviting while archived → 409", `got ${inviteArchived.status}`);
  const readArchived = await request(aisha, "GET", `/projects/${pid}`);
  check(readArchived.status === 200, "members can still read archived project", `got ${readArchived.status}`);

  const restored = await request(owner, "POST", `/projects/${pid}/restore`, {}, csrfHeader(owner));
  check(restored.status === 200 && restored.data?.project?.status === "active", "owner restores → active", `got ${restored.status}`);

  // ---------- 10. delete (cascade) ----------
  console.log("10) Delete project");
  const editorDelete2 = await request(aisha, "DELETE", `/projects/${pid}`, undefined, csrfHeader(aisha));
  check(editorDelete2.status === 403, "non-owner delete → 403", `got ${editorDelete2.status}`);

  const deleted = await request(owner, "DELETE", `/projects/${pid}`, undefined, csrfHeader(owner));
  check(deleted.status === 200, "owner deletes → 200", `got ${deleted.status}`);
  check(
    deleted.data?.deleted && typeof deleted.data.deleted.tasks === "number",
    "response reports cascade counts",
    JSON.stringify(deleted.data?.deleted)
  );
  const afterDelete = await request(owner, "GET", `/projects/${pid}`);
  check(afterDelete.status === 404, "detail after delete → 404", `got ${afterDelete.status}`);
  const listAfter = await request(owner, "GET", "/projects");
  check(
    !(listAfter.data?.projects || []).some((p) => p.id === pid),
    "deleted project gone from the list"
  );
  const aishaListAfter = await request(aisha, "GET", "/projects");
  check(
    !(aishaListAfter.data?.projects || []).some((p) => p.id === pid),
    "deleted project gone from member lists too"
  );

  // ---------- summary ----------
  console.log("\n──────────────────────────────────────");
  console.log(`  ${passed}/${passed + failed} checks passed${failed ? ` (${failed} failed)` : " 🎉"}`);
  console.log("──────────────────────────────────────\n");
  process.exit(failed ? 1 : 0);
})().catch((error) => {
  console.error("Smoke test crashed:", error);
  process.exit(1);
});
