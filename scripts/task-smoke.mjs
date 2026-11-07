#!/usr/bin/env node
/**
 * WorkFlow task-management smoke test.
 *
 * Covers: task CRUD with every field, assignee-must-be-member, priority &
 * status changes (editor+ vs assignee vs viewer), subtasks, link attachments,
 * search / filters / sorting (deadline + priority), membership isolation
 * (non-member → 404), archived-project read-only (409), and CSRF enforcement.
 *
 * Usage:
 *   node scripts/task-smoke.mjs                          # direct:  http://localhost:4000/api
 *   API_URL=http://localhost:5173 node scripts/task-smoke.mjs   # via Vite proxy
 *
 * Requires the backend running and seeded demo data:
 *   cd backend && npm run seed -- --reset
 *   demo@workflow.app / Demo@1234     (owner)
 *   aisha@workflow.app / Team mate@123  (editor in the fixture project)
 *   rahul@workflow.app / Team mate@123  (viewer in the fixture project)
 *   sarah@workflow.app / Team mate@123  (non-member → 404 everywhere)
 *
 * The test creates and removes its own fixture project, so it is safe to run
 * repeatedly against seeded data.
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

const iso = (offsetDays) => new Date(Date.now() + offsetDays * 86400000).toISOString();

// ============================================================
(async () => {
  console.log(`\n📋 WorkFlow task smoke test → ${BASE}${PREFIX}\n`);

  const owner = await login(OWNER);
  const aisha = await login(AISHA);
  const rahul = await login(RAHUL);
  const sarah = await login(SARAH);
  ok("logged in as owner, aisha, rahul, sarah");

  // ---------- 0. seeded regression guard ----------
  console.log("0) Seeded task data");
  const seeded = await request(owner, "GET", "/tasks?q=pricing");
  const priced = (seeded.data?.tasks || [])[0];
  check(
    seeded.status === 200 && Boolean(priced),
    "seeded task findable by search"
  );
  check(
    (priced?.labels || []).length > 0,
    "seeded task carries labels",
    JSON.stringify(priced?.labels)
  );
  check(
    (priced?.subtaskProgress?.total || 0) > 0,
    "seeded task carries subtasks",
    `${priced?.subtaskProgress?.completed}/${priced?.subtaskProgress?.total}`
  );

  // ---------- 1. fixture project ----------
  console.log("1) Fixture project + roles");
  const project = await request(
    owner,
    "POST",
    "/projects",
    {
      name: "Task Smoke Project",
      description: "Created by task-smoke.mjs",
      color: "indigo",
    },
    csrfHeader(owner)
  );
  check(project.status === 201, "POST /projects → 201", `got ${project.status}`);
  const pid = project.data?.project?.id;
  check(Boolean(pid), "fixture project id");

  const inviteAisha = await request(
    owner,
    "POST",
    "/invitations",
    { projectId: pid, email: AISHA.email, role: "editor" },
    csrfHeader(owner)
  );
  check(inviteAisha.status === 201, "invite aisha as editor → 201", `got ${inviteAisha.status}`);
  const aAccept = await request(
    aisha,
    "POST",
    `/invitations/${inviteAisha.data?.invitation?.id}/accept`,
    {},
    csrfHeader(aisha)
  );
  check(aAccept.status === 200, "aisha accepts → 200", `got ${aAccept.status}`);

  const inviteRahul = await request(
    owner,
    "POST",
    "/invitations",
    { projectId: pid, email: RAHUL.email, role: "viewer" },
    csrfHeader(owner)
  );
  check(inviteRahul.status === 201, "invite rahul as viewer → 201", `got ${inviteRahul.status}`);
  const rAccept = await request(
    rahul,
    "POST",
    `/invitations/${inviteRahul.data?.invitation?.id}/accept`,
    {},
    csrfHeader(rahul)
  );
  check(rAccept.status === 200, "rahul accepts → 200", `got ${rAccept.status}`);

  const projDetail = await request(owner, "GET", `/projects/${pid}`);
  const members = projDetail.data?.project?.members || [];
  const aishaMember = members.find((m) => m.email === AISHA.email);
  const rahulMember = members.find((m) => m.email === RAHUL.email);
  check(
    projDetail.status === 200 && Boolean(aishaMember) && Boolean(rahulMember),
    "fixture members resolved",
    members.map((m) => `${m.email}(${m.role})`).join(", ")
  );

  // ---------- 2. create ----------
  console.log("2) Create task");
  const noCsrf = await request(owner, "POST", "/tasks", { projectId: pid, title: "No CSRF" });
  check(noCsrf.status === 403, "state change without CSRF header → 403", `got ${noCsrf.status}`);

  const created = await request(
    owner,
    "POST",
    "/tasks",
    {
      projectId: pid,
      title: "Ship the smoke test",
      description: "Full-field create",
      priority: "urgent",
      startDate: iso(-1),
      dueDate: iso(3),
      labels: ["Bug", " Backend ", "bug"],
      assignee: aishaMember.id,
    },
    csrfHeader(owner)
  );
  check(created.status === 201, "POST /tasks (all fields) → 201", `got ${created.status}`);
  const t1 = created.data?.task;
  check(t1?.title === "Ship the smoke test", "title echoed");
  check(t1?.priority === "urgent", "priority applied");
  check(
    JSON.stringify(t1?.labels) === JSON.stringify(["bug", "backend"]),
    "labels normalized (trim/lowercase/dedupe)",
    JSON.stringify(t1?.labels)
  );
  check(Boolean(t1?.startDate) && Boolean(t1?.dueDate), "start + due dates stored");
  check(t1?.assignee?.email === AISHA.email, "assignee stored + populated");
  check(t1?.myRole === "owner", "myRole = owner");
  check(
    (t1?.members || []).length === 3,
    "project members embedded for the assignee picker",
    `${t1?.members?.length}`
  );
  check(
    t1?.project?.name === "Task Smoke Project",
    "project populated"
  );

  const badTitle = await request(
    owner,
    "POST",
    "/tasks",
    { projectId: pid, title: "x" },
    csrfHeader(owner)
  );
  check(badTitle.status === 400, "title < 2 chars → 400", `got ${badTitle.status}`);

  const badDates = await request(
    owner,
    "POST",
    "/tasks",
    { projectId: pid, title: "Backwards dates", startDate: iso(5), dueDate: iso(1) },
    csrfHeader(owner)
  );
  check(badDates.status === 400, "start date after due date → 400", `got ${badDates.status}`);

  const badAssignee = await request(
    owner,
    "POST",
    "/tasks",
    { projectId: pid, title: "Assign outsider", assignee: "6ae9fd11d6e8e57048c00000" },
    csrfHeader(owner)
  );
  check(badAssignee.status === 400, "assignee outside project → 400", `got ${badAssignee.status}`);

  const badPriority = await request(
    owner,
    "POST",
    "/tasks",
    { projectId: pid, title: "Bad priority", priority: "critical" },
    csrfHeader(owner)
  );
  check(badPriority.status === 400, "unknown priority → 400", `got ${badPriority.status}`);

  const tooManyLabels = await request(
    owner,
    "POST",
    "/tasks",
    {
      projectId: pid,
      title: "Label overload",
      labels: ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k"],
    },
    csrfHeader(owner)
  );
  check(tooManyLabels.status === 400, "11 labels → 400 (max 10)", `got ${tooManyLabels.status}`);

  const viewerCreate = await request(
    rahul,
    "POST",
    "/tasks",
    { projectId: pid, title: "Viewer tries" },
    csrfHeader(rahul)
  );
  check(viewerCreate.status === 403, "viewer create → 403", `got ${viewerCreate.status}`);

  const outsiderCreate = await request(
    sarah,
    "POST",
    "/tasks",
    { projectId: pid, title: "Outsider tries" },
    csrfHeader(sarah)
  );
  check(outsiderCreate.status === 404, "non-member create → 404 (no leak)", `got ${outsiderCreate.status}`);

  // ---------- 3. read + list ----------
  console.log("3) Read + list");
  const detail = await request(owner, "GET", `/tasks/${t1.id}`);
  check(detail.status === 200, "GET /tasks/:id → 200", `got ${detail.status}`);
  check(
    Array.isArray(detail.data?.task?.subtasks) &&
      Array.isArray(detail.data?.task?.attachments) &&
      Array.isArray(detail.data?.task?.labels),
    "detail includes subtasks/attachments/labels arrays"
  );

  const aishaRead = await request(aisha, "GET", `/tasks/${t1.id}`);
  check(aishaRead.status === 200, "member (editor) reads task → 200", `got ${aishaRead.status}`);

  const sarahRead = await request(sarah, "GET", `/tasks/${t1.id}`);
  check(sarahRead.status === 404, "non-member GET → 404 (no leak)", `got ${sarahRead.status}`);

  const malformed = await request(owner, "GET", "/tasks/not-an-id");
  check(malformed.status === 400, "malformed task id → 400", `got ${malformed.status}`);

  const missing = await request(owner, "GET", "/tasks/6ae9fd11d6e8e57048c00000");
  check(missing.status === 404, "unknown task id → 404", `got ${missing.status}`);

  const list = await request(owner, "GET", "/tasks");
  check(list.status === 200, "GET /tasks → 200", `got ${list.status}`);
  check((list.data?.count || 0) >= 33, "seeded + new tasks returned", `count ${list.data?.count}`);
  const archivedHidden = (list.data?.tasks || []).filter(
    (t) => t.project?.status === "archived"
  );
  check(archivedHidden.length === 0, "archived-project tasks hidden from global list");
  let sawNullDue = false;
  let dueSorted = true;
  for (const t of list.data?.tasks || []) {
    if (!t.dueDate) sawNullDue = true;
    else if (sawNullDue) dueSorted = false;
  }
  check(dueSorted, "default sort = deadline ascending, nulls last");

  const scoped = await request(owner, "GET", `/tasks?projectId=${pid}`);
  check(
    scoped.status === 200 &&
      (scoped.data?.tasks || []).every((t) => t.project?.id === pid),
    "projectId scope returns only that project's tasks",
    `count ${scoped.data?.count}`
  );

  const outsiderScoped = await request(sarah, "GET", `/tasks?projectId=${pid}`);
  check(outsiderScoped.status === 404, "non-member list by projectId → 404", `got ${outsiderScoped.status}`);

  const search = await request(owner, "GET", "/tasks?q=video");
  check(
    search.status === 200 &&
      (search.data?.tasks || []).every(
        (t) => /video/i.test(t.title) || /video/i.test(t.description || "")
      ),
    "search q matches title/description only",
    `count ${search.data?.count}`
  );

  const byStatus = await request(owner, "GET", "/tasks?status=done");
  check(
    byStatus.status === 200 &&
      (byStatus.data?.tasks || []).length > 0 &&
      (byStatus.data?.tasks || []).every((t) => t.status === "done"),
    "status filter returns only done tasks",
    `count ${byStatus.data?.count}`
  );

  const byPriority = await request(owner, "GET", "/tasks?priority=urgent");
  check(
    byPriority.status === 200 &&
      (byPriority.data?.tasks || []).every((t) => t.priority === "urgent"),
    "priority filter returns only urgent tasks",
    `count ${byPriority.data?.count}`
  );

  const byMe = await request(owner, "GET", "/tasks?assignee=me");
  check(
    byMe.status === 200 &&
      (byMe.data?.tasks || []).length > 0 &&
      (byMe.data?.tasks || []).every((t) => t.assignee?.email === OWNER.email),
    "assignee=me returns my tasks",
    `count ${byMe.data?.count}`
  );

  const unassigned = await request(owner, "GET", "/tasks?assignee=none");
  check(
    unassigned.status === 200 &&
      (unassigned.data?.tasks || []).every((t) => t.assignee === null),
    "assignee=none returns only unassigned tasks",
    `count ${unassigned.data?.count}`
  );

  const byLabel = await request(owner, "GET", "/tasks?label=qa");
  check(
    byLabel.status === 200 &&
      (byLabel.data?.tasks || []).length >= 2 &&
      (byLabel.data?.tasks || []).every((t) => t.labels.includes("qa")),
    "label filter returns only labelled tasks",
    `count ${byLabel.data?.count}`
  );

  const priDesc = await request(owner, "GET", "/tasks?sort=priority&order=desc");
  check(
    priDesc.status === 200 && priDesc.data?.tasks?.[0]?.priority === "urgent",
    "priority desc → urgent first",
    `first ${priDesc.data?.tasks?.[0]?.priority}`
  );
  const priAsc = await request(owner, "GET", "/tasks?sort=priority&order=asc");
  check(
    priAsc.status === 200 && priAsc.data?.tasks?.[0]?.priority === "low",
    "priority asc → low first",
    `first ${priAsc.data?.tasks?.[0]?.priority}`
  );
  const byCreated = await request(owner, "GET", "/tasks?sort=created&order=desc");
  check(
    byCreated.status === 200 &&
      byCreated.data?.tasks?.[0]?.id === t1.id,
    "created desc → newest task first"
  );

  const badSort = await request(owner, "GET", "/tasks?sort=bogus");
  check(badSort.status === 400, "unknown sort field → 400", `got ${badSort.status}`);
  const badFilter = await request(owner, "GET", "/tasks?status=bogus");
  check(badFilter.status === 400, "unknown status filter → 400", `got ${badFilter.status}`);

  // ---------- 4. edit ----------
  console.log("4) Edit task");
  const ownerEdit = await request(
    owner,
    "PATCH",
    `/tasks/${t1.id}`,
    { title: "Ship the smoke test v2", description: "Edited", priority: "high" },
    csrfHeader(owner)
  );
  check(ownerEdit.status === 200, "owner PATCH → 200", `got ${ownerEdit.status}`);
  check(
    ownerEdit.data?.task?.title === "Ship the smoke test v2" &&
      ownerEdit.data?.task?.priority === "high",
    "edits applied"
  );

  const editorEdit = await request(
    aisha,
    "PATCH",
    `/tasks/${t1.id}`,
    { labels: ["Hot", "hot", "UX"] },
    csrfHeader(aisha)
  );
  check(editorEdit.status === 200, "editor PATCH → 200", `got ${editorEdit.status}`);
  check(
    JSON.stringify(editorEdit.data?.task?.labels) === JSON.stringify(["hot", "ux"]),
    "editor's labels normalized",
    JSON.stringify(editorEdit.data?.task?.labels)
  );

  const reassignReal = await request(
    owner,
    "PATCH",
    `/tasks/${t1.id}`,
    { assignee: rahulMember.id },
    csrfHeader(owner)
  );
  check(reassignReal.status === 200, "assign to project member → 200", `got ${reassignReal.status}`);
  check(reassignReal.data?.task?.assignee?.email === RAHUL.email, "assignee changed");
  const backToAisha = await request(
    owner,
    "PATCH",
    `/tasks/${t1.id}`,
    { assignee: aishaMember.id },
    csrfHeader(owner)
  );
  check(backToAisha.status === 200 && backToAisha.data?.task?.assignee?.email === AISHA.email,
    "assignee can be moved back");

  const outsiderAssign = await request(
    owner,
    "PATCH",
    `/tasks/${t1.id}`,
    { assignee: "6ae9fd11d6e8e57048c00000" },
    csrfHeader(owner)
  );
  check(outsiderAssign.status === 400, "assignee outside project → 400", `got ${outsiderAssign.status}`);

  const viewerEdit = await request(
    rahul,
    "PATCH",
    `/tasks/${t1.id}`,
    { title: "Viewer edit" },
    csrfHeader(rahul)
  );
  check(viewerEdit.status === 403, "viewer PATCH → 403", `got ${viewerEdit.status}`);

  const outsiderEdit = await request(
    sarah,
    "PATCH",
    `/tasks/${t1.id}`,
    { title: "Outsider edit" },
    csrfHeader(sarah)
  );
  check(outsiderEdit.status === 404, "non-member PATCH → 404", `got ${outsiderEdit.status}`);

  // ---------- 5. status ----------
  console.log("5) Status updates");
  const markDone = await request(
    owner,
    "PATCH",
    `/tasks/${t1.id}/status`,
    { status: "done" },
    csrfHeader(owner)
  );
  check(markDone.status === 200, "owner sets status → 200", `got ${markDone.status}`);
  check(
    markDone.data?.task?.status === "done" && Boolean(markDone.data?.task?.completedAt),
    "done sets completedAt"
  );
  const markTodo = await request(
    owner,
    "PATCH",
    `/tasks/${t1.id}/status`,
    { status: "todo" },
    csrfHeader(owner)
  );
  check(
    markTodo.status === 200 && markTodo.data?.task?.completedAt === null,
    "reopening clears completedAt"
  );

  // T2 assigned to rahul (viewer) — the assignee-progress rule
  const t2res = await request(
    owner,
    "POST",
    "/tasks",
    {
      projectId: pid,
      title: "Rahul's assigned task",
      priority: "medium",
      assignee: rahulMember.id,
    },
    csrfHeader(owner)
  );
  check(t2res.status === 201, "second task created (assigned to rahul)", `got ${t2res.status}`);
  const t2 = t2res.data?.task;

  const assigneeStatus = await request(
    rahul,
    "PATCH",
    `/tasks/${t2.id}/status`,
    { status: "in-progress" },
    csrfHeader(rahul)
  );
  check(assigneeStatus.status === 200, "viewer-assigned assignee updates status → 200", `got ${assigneeStatus.status}`);

  const viewerForeignStatus = await request(
    rahul,
    "PATCH",
    `/tasks/${t1.id}/status`,
    { status: "done" },
    csrfHeader(rahul)
  );
  check(viewerForeignStatus.status === 403, "viewer can't status a task not assigned to them → 403", `got ${viewerForeignStatus.status}`);

  const outsiderStatus = await request(
    sarah,
    "PATCH",
    `/tasks/${t1.id}/status`,
    { status: "done" },
    csrfHeader(sarah)
  );
  check(outsiderStatus.status === 404, "non-member status → 404", `got ${outsiderStatus.status}`);

  const badStatus = await request(
    owner,
    "PATCH",
    `/tasks/${t1.id}/status`,
    { status: "blocked" },
    csrfHeader(owner)
  );
  check(badStatus.status === 400, "unknown status → 400", `got ${badStatus.status}`);

  // ---------- 6. subtasks ----------
  console.log("6) Subtasks");
  const sub1 = await request(
    owner,
    "POST",
    `/tasks/${t1.id}/subtasks`,
    { title: "Write the changelog" },
    csrfHeader(owner)
  );
  check(sub1.status === 201, "owner adds subtask → 201", `got ${sub1.status}`);
  check(
    sub1.data?.task?.subtaskProgress?.total === 1 &&
      sub1.data?.task?.subtaskProgress?.completed === 0,
    "subtask progress 0/1"
  );
  const sub1Id = sub1.data?.task?.subtasks?.[0]?.id;

  const assigneeSub = await request(
    rahul,
    "POST",
    `/tasks/${t2.id}/subtasks`,
    { title: "Rahul adds his own" },
    csrfHeader(rahul)
  );
  check(assigneeSub.status === 201, "assignee (viewer) adds subtask on assigned task → 201", `got ${assigneeSub.status}`);

  const viewerForeignSub = await request(
    rahul,
    "POST",
    `/tasks/${t1.id}/subtasks`,
    { title: "Rahul intrudes" },
    csrfHeader(rahul)
  );
  check(viewerForeignSub.status === 403, "viewer adds subtask on foreign task → 403", `got ${viewerForeignSub.status}`);

  const completeSub = await request(
    aisha,
    "PATCH",
    `/tasks/${t1.id}/subtasks/${sub1Id}`,
    { completed: true },
    csrfHeader(aisha)
  );
  check(
    completeSub.status === 200 &&
      completeSub.data?.task?.subtaskProgress?.completed === 1,
    "editor completes subtask → progress 1/1",
    `got ${completeSub.status}`
  );

  const missingSub = await request(
    owner,
    "PATCH",
    `/tasks/${t1.id}/subtasks/6ae9fd11d6e8e57048c00000`,
    { completed: true },
    csrfHeader(owner)
  );
  check(missingSub.status === 404, "completing unknown subtask → 404", `got ${missingSub.status}`);

  const badSubTitle = await request(
    owner,
    "POST",
    `/tasks/${t1.id}/subtasks`,
    { title: "x" },
    csrfHeader(owner)
  );
  check(badSubTitle.status === 400, "subtask title < 2 chars → 400", `got ${badSubTitle.status}`);

  const outsiderSub = await request(
    sarah,
    "POST",
    `/tasks/${t1.id}/subtasks`,
    { title: "Outsider subtask" },
    csrfHeader(sarah)
  );
  check(outsiderSub.status === 404, "non-member subtask → 404", `got ${outsiderSub.status}`);

  const delSub = await request(
    owner,
    "DELETE",
    `/tasks/${t1.id}/subtasks/${sub1Id}`,
    undefined,
    csrfHeader(owner)
  );
  check(
    delSub.status === 200 && delSub.data?.task?.subtaskProgress?.total === 0,
    "subtask deleted → progress 0/0",
    `got ${delSub.status}`
  );

  // ---------- 7. attachments ----------
  console.log("7) Attachments");
  const att1 = await request(
    owner,
    "POST",
    `/tasks/${t1.id}/attachments`,
    { url: "https://www.figma.com/file/smoke-test", name: "Mockup" },
    csrfHeader(owner)
  );
  check(att1.status === 201, "owner adds link attachment → 201", `got ${att1.status}`);
  check(att1.data?.task?.attachments?.length === 1, "attachment stored");
  const attId = att1.data?.task?.attachments?.[0]?.id;

  const editorAtt = await request(
    aisha,
    "POST",
    `/tasks/${t1.id}/attachments`,
    { url: "https://example.com/spec.pdf" },
    csrfHeader(aisha)
  );
  check(editorAtt.status === 201, "editor adds attachment → 201", `got ${editorAtt.status}`);

  const viewerAtt = await request(
    rahul,
    "POST",
    `/tasks/${t1.id}/attachments`,
    { url: "https://example.com/nope" },
    csrfHeader(rahul)
  );
  check(viewerAtt.status === 403, "viewer adds attachment → 403", `got ${viewerAtt.status}`);

  const badUrl = await request(
    owner,
    "POST",
    `/tasks/${t1.id}/attachments`,
    { url: "ftp://files.example.com/x" },
    csrfHeader(owner)
  );
  check(badUrl.status === 400, "non-http(s) URL → 400", `got ${badUrl.status}`);

  const outsiderAtt = await request(
    sarah,
    "POST",
    `/tasks/${t1.id}/attachments`,
    { url: "https://example.com/x" },
    csrfHeader(sarah)
  );
  check(outsiderAtt.status === 404, "non-member attachment → 404", `got ${outsiderAtt.status}`);

  const delAtt = await request(
    owner,
    "DELETE",
    `/tasks/${t1.id}/attachments/${attId}`,
    undefined,
    csrfHeader(owner)
  );
  check(delAtt.status === 200, "attachment removed → 200", `got ${delAtt.status}`);

  // ---------- 8. delete ----------
  console.log("8) Delete task");
  const viewerDelete = await request(
    rahul,
    "DELETE",
    `/tasks/${t1.id}`,
    undefined,
    csrfHeader(rahul)
  );
  check(viewerDelete.status === 403, "viewer DELETE → 403", `got ${viewerDelete.status}`);

  const outsiderDelete = await request(
    sarah,
    "DELETE",
    `/tasks/${t1.id}`,
    undefined,
    csrfHeader(sarah)
  );
  check(outsiderDelete.status === 404, "non-member DELETE → 404", `got ${outsiderDelete.status}`);

  const editorDelete = await request(
    aisha,
    "DELETE",
    `/tasks/${t2.id}`,
    undefined,
    csrfHeader(aisha)
  );
  check(editorDelete.status === 200, "editor DELETE → 200", `got ${editorDelete.status}`);
  const t2Gone = await request(owner, "GET", `/tasks/${t2.id}`);
  check(t2Gone.status === 404, "deleted task → 404", `got ${t2Gone.status}`);

  // ---------- 9. archived project = read-only ----------
  console.log("9) Archived project");
  const archive = await request(owner, "POST", `/projects/${pid}/archive`, {}, csrfHeader(owner));
  check(archive.status === 200, "owner archives fixture project → 200", `got ${archive.status}`);

  const archCreate = await request(
    owner,
    "POST",
    "/tasks",
    { projectId: pid, title: "While archived" },
    csrfHeader(owner)
  );
  check(archCreate.status === 409, "create in archived project → 409", `got ${archCreate.status}`);
  const archEdit = await request(
    owner,
    "PATCH",
    `/tasks/${t1.id}`,
    { title: "While archived" },
    csrfHeader(owner)
  );
  check(archEdit.status === 409, "edit in archived project → 409", `got ${archEdit.status}`);
  const archStatus = await request(
    owner,
    "PATCH",
    `/tasks/${t1.id}/status`,
    { status: "done" },
    csrfHeader(owner)
  );
  check(archStatus.status === 409, "status in archived project → 409", `got ${archStatus.status}`);
  const archSub = await request(
    owner,
    "POST",
    `/tasks/${t1.id}/subtasks`,
    { title: "While archived" },
    csrfHeader(owner)
  );
  check(archSub.status === 409, "subtask in archived project → 409", `got ${archSub.status}`);
  const archAtt = await request(
    owner,
    "POST",
    `/tasks/${t1.id}/attachments`,
    { url: "https://example.com/archived" },
    csrfHeader(owner)
  );
  check(archAtt.status === 409, "attachment in archived project → 409", `got ${archAtt.status}`);
  const archDelete = await request(
    owner,
    "DELETE",
    `/tasks/${t1.id}`,
    undefined,
    csrfHeader(owner)
  );
  check(archDelete.status === 409, "delete in archived project → 409", `got ${archDelete.status}`);

  const archRead = await request(aisha, "GET", `/tasks/${t1.id}`);
  check(archRead.status === 200, "members still READ archived tasks → 200", `got ${archRead.status}`);
  const archList = await request(owner, "GET", `/tasks?projectId=${pid}`);
  check(archList.status === 200, "explicit projectId list of archived → 200", `got ${archList.status}`);

  const restore = await request(owner, "POST", `/projects/${pid}/restore`, {}, csrfHeader(owner));
  check(restore.status === 200, "owner restores project → 200", `got ${restore.status}`);
  const postRestore = await request(
    owner,
    "PATCH",
    `/tasks/${t1.id}/status`,
    { status: "in-progress" },
    csrfHeader(owner)
  );
  check(postRestore.status === 200, "mutations work again after restore", `got ${postRestore.status}`);

  // ---------- 10. cleanup ----------
  console.log("10) Cleanup");
  const cleanupDelete = await request(
    owner,
    "DELETE",
    `/tasks/${t1.id}`,
    undefined,
    csrfHeader(owner)
  );
  check(cleanupDelete.status === 200, "fixture task deleted", `got ${cleanupDelete.status}`);

  const projectDelete = await request(
    owner,
    "DELETE",
    `/projects/${pid}`,
    undefined,
    csrfHeader(owner)
  );
  check(projectDelete.status === 200, "fixture project deleted", `got ${projectDelete.status}`);

  const finalList = await request(owner, "GET", "/tasks");
  check(
    (finalList.data?.tasks || []).every((t) => t.project?.id !== pid),
    "no fixture tasks remain in the list"
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
