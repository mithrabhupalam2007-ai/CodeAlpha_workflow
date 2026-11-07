#!/usr/bin/env node
/**
 * WorkFlow kanban board smoke test.
 *
 * Covers: `in-review` status round-trip, position ordering (within-column
 * reorder), cross-column moves (status + completedAt), self-heal when
 * orderedIds omit ids, viewer vs editor vs assignee move permissions,
 * non-member 404, invalid payloads (400), comments incl. threaded replies
 * (parentId, one nesting level, author-only edit, parent delete cascades),
 * multipart file uploads (/uploads static serving, permission + type/size
 * rules, unlink on delete), task activity history (actor, newest-first,
 * non-member 404), archived project 409s, and CSRF enforcement.
 *
 * Usage:
 *   node scripts/board-smoke.mjs                                # direct :4000
 *   API_URL=http://localhost:5173 node scripts/board-smoke.mjs  # via Vite proxy
 *
 * Requires the backend running and seeded demo data:
 *   cd backend && npm run seed -- --reset
 *   demo@workflow.app / Demo@1234       (owner)
 *   aisha@workflow.app / Teammate@123   (invited as editor)
 *   rahul@workflow.app / Teammate@123   (invited as viewer)
 *   sarah@workflow.app / Teammate@123   (non-member → 404)
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

// ---------- tiny cookie jar (same as the other smoke scripts) ----------
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
  console.log(`\n🗂️  WorkFlow board smoke test → ${BASE}${PREFIX}\n`);

  const owner = await login(OWNER);
  const aisha = await login(AISHA);
  const rahul = await login(RAHUL);
  const sarah = await login(SARAH);
  ok("logged in as owner, aisha, rahul, sarah");

  const me = await request(rahul, "GET", "/auth/me");
  const rahulId = me.data?.user?.id;
  check(Boolean(rahulId), "resolved rahul's user id");

  // ---------- 0. seeded data ----------
  console.log("0) Seeded board data");
  const seeded = await request(owner, "GET", "/tasks?status=in-review&sort=position");
  check(seeded.status === 200, "GET /tasks?status=in-review → 200", `got ${seeded.status}`);
  const inReview = seeded.data?.tasks || [];
  check(inReview.length === 3, "3 seeded in-review tasks", `got ${inReview.length}`);
  check(
    inReview.every(
      (t) => t.status === "in-review" && typeof t.position === "number" && t.commentCount !== undefined
    ),
    "each seeded in-review task carries position + comments"
  );

  const seededBoard = await request(owner, "GET", "/tasks?sort=position");
  const allSeeded = seededBoard.data?.tasks || [];
  check(seededBoard.status === 200, "GET /tasks?sort=position → 200");
  check(
    allSeeded.every((t) => typeof t.position === "number"),
    "every task carries a numeric position"
  );

  // ---------- 1. fixture project ----------
  console.log("1) Fixture project + roles");
  const project = await request(
    owner,
    "POST",
    "/projects",
    { name: "Board Smoke Project", description: "Created by board-smoke.mjs", color: "sky" },
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
  const aAccept = await request(
    aisha,
    "POST",
    `/invitations/${inviteAisha.data?.invitation?.id}/accept`,
    {},
    csrfHeader(aisha)
  );
  check(aAccept.status === 200, "aisha accepts (editor) → 200", `got ${aAccept.status}`);

  const inviteRahul = await request(
    owner,
    "POST",
    "/invitations",
    { projectId: pid, email: RAHUL.email, role: "viewer" },
    csrfHeader(owner)
  );
  const rAccept = await request(
    rahul,
    "POST",
    `/invitations/${inviteRahul.data?.invitation?.id}/accept`,
    {},
    csrfHeader(rahul)
  );
  check(rAccept.status === 200, "rahul accepts (viewer) → 200", `got ${rAccept.status}`);

  // ---------- 2. fixture tasks + create-at-top ordering ----------
  console.log("2) Fixture tasks + create-at-top ordering");
  const mk = async (title) => {
    const res = await request(
      owner,
      "POST",
      "/tasks",
      { projectId: pid, title, priority: "medium" },
      csrfHeader(owner)
    );
    check(res.status === 201, `create “${title}” → 201`, `got ${res.status}`);
    return res.data?.task;
  };
  const t1 = await mk("Board task one");
  const t2 = await mk("Board task two");
  const t3 = await mk("Board task three");

  const fresh = await request(owner, "GET", `/tasks?projectId=${pid}&sort=position`);
  const todoFresh = (fresh.data?.tasks || []).filter((t) => t.status === "todo");
  check(
    todoFresh.length === 3 && todoFresh[0]?.id === t3.id,
    "new task lands at the TOP of its column",
    "newest first"
  );

  // ---------- 3. move: validation + permissions ----------
  console.log("3) Move validation & permissions");
  const badStatus = await request(
    owner,
    "PATCH",
    `/tasks/${t1.id}/move`,
    { status: "ship-it" },
    csrfHeader(owner)
  );
  check(badStatus.status === 400, "invalid status enum → 400", `got ${badStatus.status}`);

  const badIds = await request(
    owner,
    "PATCH",
    `/tasks/${t1.id}/move`,
    { orderedIds: "not-an-array" },
    csrfHeader(owner)
  );
  check(badIds.status === 400, "orderedIds not an array → 400", `got ${badIds.status}`);

  const noCsrf = await request(owner, "PATCH", `/tasks/${t1.id}/move`, { status: "done" });
  check(noCsrf.status === 403, "PATCH /move without CSRF token → 403", `got ${noCsrf.status}`);

  const nonMember = await request(
    sarah,
    "PATCH",
    `/tasks/${t1.id}/move`,
    { status: "done" },
    csrfHeader(sarah)
  );
  check(nonMember.status === 404, "non-member move → 404", `got ${nonMember.status}`);

  const viewerMove = await request(
    rahul,
    "PATCH",
    `/tasks/${t1.id}/move`,
    { status: "done" },
    csrfHeader(rahul)
  );
  check(viewerMove.status === 403, "viewer move → 403", `got ${viewerMove.status}`);

  // ---------- 4. same-column reorder ----------
  console.log("4) Same-column reorder (positions rewritten)");
  const before = await request(owner, "GET", `/tasks?projectId=${pid}&sort=position`);
  const todoBefore = (before.data?.tasks || []).filter((t) => t.status === "todo");
  const reorderedIds = todoBefore.map((t) => t.id).reverse();

  const mv = await request(
    owner,
    "PATCH",
    `/tasks/${reorderedIds[0]}/move`,
    { orderedIds: reorderedIds },
    csrfHeader(owner)
  );
  check(mv.status === 200, "move same column → 200", `got ${mv.status} ${JSON.stringify(mv.data?.errors ?? mv.data?.message ?? "")}`);

  const after = await request(owner, "GET", `/tasks?projectId=${pid}&sort=position`);
  const todoAfter = (after.data?.tasks || [])
    .filter((t) => t.status === "todo")
    .map((t) => t.id);
  check(
    JSON.stringify(todoAfter) === JSON.stringify(reorderedIds),
    "column order matches what was sent"
  );
  const positionsAfter = (after.data?.tasks || [])
    .filter((t) => t.status === "todo")
    .map((t) => t.position);
  check(
    JSON.stringify(positionsAfter) === JSON.stringify([0, 1, 2]),
    "positions rewritten 0..n",
    JSON.stringify(positionsAfter)
  );

  // ---------- 5. cross-column move + completedAt ----------
  console.log("5) Cross-column move (status + completedAt)");
  const mvDone = await request(
    owner,
    "PATCH",
    `/tasks/${t1.id}/move`,
    { status: "done" },
    csrfHeader(owner)
  );
  check(mvDone.status === 200, "todo → done → 200", `got ${mvDone.status}`);
  check(
    mvDone.data?.task?.status === "done" && Boolean(mvDone.data?.task?.completedAt),
    "moving to done sets completedAt",
    String(mvDone.data?.task?.completedAt ?? "null")
  );

  const mvTodo = await request(
    owner,
    "PATCH",
    `/tasks/${t1.id}/move`,
    { status: "todo" },
    csrfHeader(owner)
  );
  check(
    mvTodo.data?.task?.status === "todo" && mvTodo.data?.task?.completedAt === null,
    "moving out of done clears completedAt"
  );

  const inReviewMove = await request(
    owner,
    "PATCH",
    `/tasks/${t2.id}/move`,
    { status: "in-review" },
    csrfHeader(owner)
  );
  check(
    inReviewMove.status === 200 && inReviewMove.data?.task?.status === "in-review",
    "todo → in-review works end-to-end",
    `got ${inReviewMove.status}`
  );

  // back to todo for the self-heal test
  await request(owner, "PATCH", `/tasks/${t2.id}/move`, { status: "todo" }, csrfHeader(owner));
  const t4 = await mk("Board task four"); // lands at the top of todo

  // orderedIds omits t3 (and the moved t4 is present) → t3 must self-heal, appended at the end
  const selfHeal = await request(
    owner,
    "PATCH",
    `/tasks/${t4.id}/move`,
    { orderedIds: [t4.id, t1.id] },
    csrfHeader(owner)
  );
  check(selfHeal.status === 200, "partial orderedIds accepted → 200", `got ${selfHeal.status}`);

  const healed = await request(owner, "GET", `/tasks?projectId=${pid}&sort=position`);
  const todoHealed = (healed.data?.tasks || [])
    .filter((t) => t.status === "todo")
    .map((t) => t.id);
  check(
    todoHealed[0] === t4.id && todoHealed[1] === t1.id,
    "the explicitly ordered ids kept their slots",
    todoHealed
      .map((id) => (id === t1.id ? "one" : id === t2.id ? "two" : id === t3.id ? "three" : "four"))
      .join(",")
  );
  check(
    todoHealed.includes(t3.id) && todoHealed.length === todoBefore.length + 1,
    "omitted ids self-heal by appending (nothing lost)",
    `${todoHealed.length} in column`
  );

  // restore t4 → in-review for role tests below
  await request(owner, "PATCH", `/tasks/${t4.id}/move`, { status: "in-review" }, csrfHeader(owner));

  // ---------- 6. editor + assignee permissions ----------
  console.log("6) Editor & assignee permissions");
  const editorMove = await request(
    aisha,
    "PATCH",
    `/tasks/${t3.id}/move`,
    { status: "in-progress" },
    csrfHeader(aisha)
  );
  check(editorMove.status === 200, "editor move → 200", `got ${editorMove.status}`);

  const assign = await request(
    owner,
    "PATCH",
    `/tasks/${t3.id}`,
    { assignee: rahulId },
    csrfHeader(owner)
  );
  const assigneeMove =
    assign.status === 200
      ? await request(rahul, "PATCH", `/tasks/${t3.id}/move`, { status: "todo" }, csrfHeader(rahul))
      : null;
  if (assigneeMove) {
    check(
      assigneeMove.status === 200,
      "assignee (viewer role) can move own task → 200",
      `got ${assigneeMove.status}`
    );
  } else {
    fail("assignee move setup failed", JSON.stringify(assign.data));
  }

  // ---------- 7. comments ----------
  console.log("7) Comments");
  const longText = "x".repeat(2001);
  const tooLong = await request(
    owner,
    "POST",
    `/tasks/${t1.id}/comments`,
    { text: longText },
    csrfHeader(owner)
  );
  check(tooLong.status === 400, "comment > 2000 chars → 400", `got ${tooLong.status}`);

  const emptyComment = await request(
    owner,
    "POST",
    `/tasks/${t1.id}/comments`,
    { text: "   " },
    csrfHeader(owner)
  );
  check(emptyComment.status === 400, "blank comment → 400", `got ${emptyComment.status}`);

  const viewerComment = await request(
    rahul,
    "POST",
    `/tasks/${t1.id}/comments`,
    { text: "Viewer comment" },
    csrfHeader(rahul)
  );
  check(
    viewerComment.status === 201 && viewerComment.data?.task?.commentCount === 1,
    "viewer can comment → 201, count 1",
    `got ${viewerComment.status}`
  );
  const viewerCommentId = viewerComment.data?.task?.comments?.[0]?.id;
  check(Boolean(viewerCommentId), "returned comment carries an id + author", viewerComment.data?.task?.comments?.[0]?.author?.name);

  const ownerComment = await request(
    owner,
    "POST",
    `/tasks/${t1.id}/comments`,
    { text: "Owner comment" },
    csrfHeader(owner)
  );
  check(
    ownerComment.status === 201 && ownerComment.data?.task?.commentCount === 2,
    "owner comment → count 2",
    `got ${ownerComment.status}`
  );

  const viewerDeleteOthers = await request(
    rahul,
    "DELETE",
    `/tasks/${t1.id}/comments/${ownerComment.data?.task?.comments?.at(-1)?.id}`,
    undefined,
    csrfHeader(rahul)
  );
  check(
    viewerDeleteOthers.status === 403,
    "viewer deleting someone else's comment → 403",
    `got ${viewerDeleteOthers.status}`
  );

  const deleteOwn = await request(
    rahul,
    "DELETE",
    `/tasks/${t1.id}/comments/${viewerCommentId}`,
    undefined,
    csrfHeader(rahul)
  );
  check(deleteOwn.status === 200, "viewer deletes own comment → 200", `got ${deleteOwn.status}`);
  check(
    deleteOwn.data?.task?.commentCount === 1,
    "count back to 1 after delete",
    `got ${deleteOwn.data?.task?.commentCount}`
  );

  const editorDeleteOthers = await request(
    aisha,
    "DELETE",
    `/tasks/${t1.id}/comments/${ownerComment.data?.task?.comments?.at(-1)?.id}`,
    undefined,
    csrfHeader(aisha)
  );
  check(
    editorDeleteOthers.status === 200,
    "editor+ can delete anyone's comment → 200",
    `got ${editorDeleteOthers.status}`
  );

  // ---------- 7b. collaboration: replies, edits, uploads, activity ----------
  console.log("7b) Collaboration — threads, edits, uploads, activity");

  // multipart helper for the upload endpoint (request() only does JSON;
  // the browser's fetch sets the multipart boundary from the FormData)
  const multipartUpload = async (jar, taskId, form) => {
    const res = await fetch(`${BASE}${PREFIX}/tasks/${taskId}/attachments/upload`, {
      method: "POST",
      headers: {
        Cookie: cookieHeader(jar),
        "X-CSRF-Token": jar.get("wf_csrf") ?? "",
      },
      body: form,
    });
    absorbCookies(jar, res);
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* no body */
    }
    return { status: res.status, data };
  };

  const rootC = await request(
    owner,
    "POST",
    `/tasks/${t2.id}/comments`,
    { text: "Root comment" },
    csrfHeader(owner)
  );
  check(rootC.status === 201, "root comment → 201", `got ${rootC.status}`);
  const rootId = rootC.data?.task?.comments?.at(-1)?.id;

  const reply = await request(
    aisha,
    "POST",
    `/tasks/${t2.id}/comments`,
    { text: "First reply", parentId: rootId },
    csrfHeader(aisha)
  );
  const replyA = reply.data?.task?.comments?.find((c) => c.parentId === rootId);
  check(
    reply.status === 201 && Boolean(replyA),
    "reply via parentId lands nested",
    `got ${reply.status}`
  );
  check(
    Boolean(replyA?.author?.name) && replyA.author.name.startsWith("Aisha"),
    "replies carry a populated author",
    replyA?.author?.name
  );

  const deep = await request(
    aisha,
    "POST",
    `/tasks/${t2.id}/comments`,
    { text: "too deep", parentId: replyA?.id },
    csrfHeader(aisha)
  );
  check(deep.status === 400, "reply-to-reply rejected → 400", `got ${deep.status}`);

  const bogusReply = await request(
    aisha,
    "POST",
    `/tasks/${t2.id}/comments`,
    { text: "no such parent", parentId: rootC.data },
    csrfHeader(aisha)
  );
  check(bogusReply.status === 400, "parentId must be a real comment id → 400", `got ${bogusReply.status}`);

  const editOwn = await request(
    aisha,
    "PATCH",
    `/tasks/${t2.id}/comments/${replyA?.id}`,
    { text: "First reply (edited)" },
    csrfHeader(aisha)
  );
  const edited = editOwn.data?.task?.comments?.find((c) => c.id === replyA?.id);
  check(
    editOwn.status === 200 &&
      edited?.text === "First reply (edited)" &&
      Boolean(edited?.editedAt),
    "author edits own comment → editedAt set",
    `got ${editOwn.status}`
  );

  const editOther = await request(
    rahul,
    "PATCH",
    `/tasks/${t2.id}/comments/${replyA?.id}`,
    { text: "hijack" },
    csrfHeader(rahul)
  );
  check(editOther.status === 403, "editing someone else's comment → 403", `got ${editOther.status}`);

  const ownerEditOther = await request(
    owner,
    "PATCH",
    `/tasks/${t2.id}/comments/${replyA?.id}`,
    { text: "still no" },
    csrfHeader(owner)
  );
  check(
    ownerEditOther.status === 403,
    "even owners can't edit others' comments",
    `got ${ownerEditOther.status}`
  );

  const delParent = await request(
    owner,
    "DELETE",
    `/tasks/${t2.id}/comments/${rootId}`,
    undefined,
    csrfHeader(owner)
  );
  const orphans = (delParent.data?.task?.comments || []).filter(
    (c) => c.parentId === rootId
  );
  check(
    delParent.status === 200 && orphans.length === 0,
    "deleting a parent removes its replies",
    `${delParent.data?.task?.commentCount} remaining`
  );

  // ----- uploads -----
  console.log("7c) Attachment uploads (multipart files)");
  const makeForm = (bytes, name, type) => {
    const form = new FormData();
    form.append("file", new Blob([bytes], { type }), name);
    return form;
  };

  const upOwner = await multipartUpload(
    owner,
    t2.id,
    makeForm("hello smoke", "notes.txt", "text/plain")
  );
  const ownerAtt = (upOwner.data?.task?.attachments || []).at(-1);
  check(
    upOwner.status === 201 && ownerAtt?.url?.startsWith("/uploads/"),
    "owner uploads notes.txt → 201 + /uploads/ url",
    `got ${upOwner.status} ${ownerAtt?.url ?? ""}`
  );
  check(
    ownerAtt?.name === "notes.txt" &&
      ownerAtt?.size === 11 &&
      ownerAtt?.type === "text/plain" &&
      ownerAtt?.addedBy?.name === "Demo User",
    "attachment carries name/size/type/addedBy",
    JSON.stringify({
      name: ownerAtt?.name,
      size: ownerAtt?.size,
      type: ownerAtt?.type,
      addedBy: ownerAtt?.addedBy?.name,
    })
  );

  const staticFetch = await fetch(`${BASE}${ownerAtt?.url ?? ""}`);
  const staticBody = await staticFetch.text();
  check(
    staticFetch.status === 200 && staticBody === "hello smoke",
    "uploaded file fetchable via /uploads → 200 + content",
    `got ${staticFetch.status} "${staticBody}"`
  );

  const viewerUp = await multipartUpload(
    rahul,
    t2.id,
    makeForm("nope", "blocked.txt", "text/plain")
  );
  check(
    viewerUp.status === 403,
    "viewer (non-assignee) upload → 403",
    `got ${viewerUp.status}`
  );

  // make rahul the assignee → assignee (even a viewer) may attach
  const assignRahul = await request(
    owner,
    "PATCH",
    `/tasks/${t2.id}`,
    { assignee: rahulId },
    csrfHeader(owner)
  );
  check(
    assignRahul.status === 200,
    "assign t2 to rahul → 200",
    `got ${assignRahul.status}`
  );

  const assigneeUp = await multipartUpload(
    rahul,
    t2.id,
    makeForm("assignee can upload", "for-rahul.txt", "text/plain")
  );
  const rahulAtt = (assigneeUp.data?.task?.attachments || []).at(-1);
  check(
    assigneeUp.status === 201 && rahulAtt?.url?.startsWith("/uploads/"),
    "assignee (viewer role) uploads → 201",
    `got ${assigneeUp.status}`
  );

  const assigneeLink = await request(
    rahul,
    "POST",
    `/tasks/${t2.id}/attachments`,
    { url: "https://example.com/spec.pdf", name: "Spec" },
    csrfHeader(rahul)
  );
  check(
    assigneeLink.status === 201,
    "assignee can also add link attachments → 201",
    `got ${assigneeLink.status}`
  );

  const viewerRemove = await request(
    rahul,
    "DELETE",
    `/tasks/${t2.id}/attachments/${rahulAtt?.id}`,
    undefined,
    csrfHeader(rahul)
  );
  check(
    viewerRemove.status === 403,
    "viewer can't remove attachments (even own upload) → 403",
    `got ${viewerRemove.status}`
  );

  const ownerRemove = await request(
    owner,
    "DELETE",
    `/tasks/${t2.id}/attachments/${rahulAtt?.id}`,
    undefined,
    csrfHeader(owner)
  );
  check(
    ownerRemove.status === 200,
    "editor+ removes the uploaded attachment → 200",
    `got ${ownerRemove.status}`
  );

  const goneFetch = await fetch(`${BASE}${rahulAtt?.url ?? ""}`);
  check(
    goneFetch.status === 404,
    "deleted upload unlinked from disk → 404",
    `got ${goneFetch.status}`
  );

  const badType = await multipartUpload(
    owner,
    t2.id,
    makeForm("<script>evil()</script>", "evil.html", "text/html")
  );
  check(
    badType.status === 400,
    "disallowed extension (.html) → 400",
    `got ${badType.status}`
  );

  const tooBig = await multipartUpload(
    owner,
    t2.id,
    makeForm(new Uint8Array(9 * 1024 * 1024), "big.txt", "text/plain")
  );
  check(
    tooBig.status === 400,
    "upload > 8 MB → 400",
    `got ${tooBig.status}`
  );

  // ----- activity history -----
  console.log("7d) Activity history");
  const activity = await request(owner, "GET", `/tasks/${t2.id}/activity`);
  check(activity.status === 200, "GET /tasks/:id/activity → 200", `got ${activity.status}`);
  const types = (activity.data?.activity || []).map((a) => a.type);
  const wantTypes = [
    "task-created",
    "task-status",
    "task-assigned",
    "comment-added",
    "comment-edited",
    "comment-deleted",
    "attachment-added",
    "attachment-removed",
  ];
  const missing = wantTypes.filter((t) => !types.includes(t));
  check(
    missing.length === 0,
    "history records created/status/assign/comments/attachments",
    missing.length ? `missing: ${missing.join(", ")}` : types.join(" | ")
  );
  const stamps = (activity.data?.activity || []).map((a) => new Date(a.createdAt).getTime());
  check(
    stamps.length > 1 && stamps.every((t, i) => t >= (stamps[i + 1] ?? t)),
    "history is newest-first"
  );
  check(
    (activity.data?.activity || []).every((a) => a.actor?.name),
    "every activity row carries the actor",
    (activity.data?.activity || []).map((a) => a.actor?.name)[0]
  );

  const viewerActivity = await request(rahul, "GET", `/tasks/${t2.id}/activity`);
  check(
    viewerActivity.status === 200,
    "member (viewer) can read history → 200",
    `got ${viewerActivity.status}`
  );
  const nonMemberActivity = await request(sarah, "GET", `/tasks/${t2.id}/activity`);
  check(
    nonMemberActivity.status === 404,
    "non-member history read → 404",
    `got ${nonMemberActivity.status}`
  );

  // ---------- 8. archived project ----------
  console.log("8) Archived project is read-only");
  const archive = await request(
    owner,
    "POST",
    `/projects/${pid}/archive`,
    {},
    csrfHeader(owner)
  );
  check(archive.status === 200, "archive fixture project", `got ${archive.status}`);

  const archivedMove = await request(
    owner,
    "PATCH",
    `/tasks/${t2.id}/move`,
    { status: "done" },
    csrfHeader(owner)
  );
  check(archivedMove.status === 409, "move in archived project → 409", `got ${archivedMove.status}`);

  const archivedComment = await request(
    owner,
    "POST",
    `/tasks/${t1.id}/comments`,
    { text: "ghost comment" },
    csrfHeader(owner)
  );
  check(
    archivedComment.status === 409,
    "comment in archived project → 409",
    `got ${archivedComment.status}`
  );

  const archivedUpload = await multipartUpload(
    owner,
    t2.id,
    makeForm("ghost", "ghost.txt", "text/plain")
  );
  check(
    archivedUpload.status === 409,
    "upload in archived project → 409",
    `got ${archivedUpload.status}`
  );

  // ---------- 9. cleanup ----------
  console.log("9) Cleanup");
  const cleanup = await request(owner, "DELETE", `/projects/${pid}`, undefined, csrfHeader(owner));
  check(cleanup.status === 200, "fixture project deleted", `got ${cleanup.status}`);

  const dashboard = await request(owner, "GET", "/dashboard/summary");
  check(dashboard.status === 200, "dashboard still healthy", `got ${dashboard.status}`);

  // ============================================================
  console.log(
    `\n${failed === 0 ? "🎉" : "💥"} Board smoke: ${passed} passed, ${failed} failed\n`
  );
  process.exit(failed === 0 ? 0 : 1);
})();
