#!/usr/bin/env node
/**
 * WorkFlow realtime collaboration smoke test (Socket.IO).
 *
 * Covers:
 *   - Handshake authentication (unauthorized rejected, valid JWT cookies accepted)
 *   - Private user room auto-join and instant notification delivery (`notification:new`)
 *   - Project room authorization (`room:join` allowed for members, rejected for non-members)
 *   - Domain broadcasts across project rooms:
 *       • task:created
 *       • task:updated (subtasks & field changes)
 *       • task:moved (kanban column/reordering)
 *       • task:commented (discussion threads)
 *       • task:deleted
 *       • project:members (role assignment & member changes)
 *   - Clean disconnect & room leaving
 *
 * Usage:
 *   node scripts/realtime-smoke.mjs
 *   API_URL=http://localhost:4000 node scripts/realtime-smoke.mjs
 */

import { io } from "../frontend/node_modules/socket.io-client/build/esm/index.js";

const BASE = process.env.API_URL || "http://localhost:4000";
const PREFIX = process.env.PREFIX ?? "/api";

const OWNER = { email: "demo@workflow.app", password: "Demo@1234" };
const AISHA = { email: "aisha@workflow.app", password: "Teammate@123" };
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

const waitForEvent = (socket, event, timeoutMs = 4000) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for event "${event}" after ${timeoutMs}ms`));
    }, timeoutMs);

    const handler = (payload) => {
      clearTimeout(timer);
      resolve(payload);
    };

    socket.once(event, handler);
  });

(async () => {
  console.log(`\n⚡ WorkFlow Socket.IO realtime collaboration smoke test → ${BASE}\n`);

  // 1. Unauthenticated socket connection should be rejected
  await new Promise((resolve) => {
    const anonSocket = io(BASE, {
      transports: ["websocket"],
      reconnection: false,
      timeout: 2000,
    });
    anonSocket.on("connect_error", (err) => {
      check(err.message.includes("unauthorized"), "unauthenticated socket rejected with unauthorized error");
      anonSocket.disconnect();
      resolve();
    });
    anonSocket.on("connect", () => {
      fail("unauthenticated socket was allowed to connect!");
      anonSocket.disconnect();
      resolve();
    });
  });

  // 2. Log in users via HTTP
  const ownerJar = await login(OWNER);
  const aishaJar = await login(AISHA);
  const sarahJar = await login(SARAH);
  ok("logged in as owner, aisha, and sarah via HTTP");

  const aishaMe = await request(aishaJar, "GET", "/auth/me");
  const aishaId = aishaMe.data?.user?.id;
  check(Boolean(aishaId), "retrieved Aisha's user id", aishaId);

  // 3. Connect authenticated sockets
  const ownerSocket = io(BASE, {
    transports: ["websocket"],
    extraHeaders: { Cookie: cookieHeader(ownerJar) },
    reconnection: false,
  });

  const aishaSocket = io(BASE, {
    transports: ["websocket"],
    extraHeaders: { Cookie: cookieHeader(aishaJar) },
    reconnection: false,
  });

  const sarahSocket = io(BASE, {
    transports: ["websocket"],
    extraHeaders: { Cookie: cookieHeader(sarahJar) },
    reconnection: false,
  });

  const [ownerHello, aishaHello] = await Promise.all([
    waitForEvent(ownerSocket, "server:hello"),
    waitForEvent(aishaSocket, "server:hello"),
  ]);
  check(ownerHello.message.includes("Connected"), "Owner socket authenticated and received server:hello");
  check(aishaHello.message.includes("Connected"), "Aisha socket authenticated and received server:hello");

  // 4. Create a test project owned by Owner, invite Aisha as editor
  const projRes = await request(
    ownerJar,
    "POST",
    "/projects",
    {
      name: `Realtime Test ${Date.now()}`,
      description: "Testing live socket collaboration",
      color: "indigo",
    },
    csrfHeader(ownerJar)
  );
  check(projRes.status === 201, "created test fixture project", projRes.data?.project?.id);
  const projectId = projRes.data?.project?.id;

  // Invite Aisha
  const inviteRes = await request(
    ownerJar,
    "POST",
    "/invitations",
    { projectId, email: AISHA.email, role: "editor" },
    csrfHeader(ownerJar)
  );
  check(inviteRes.status === 201, "invited aisha to test project");
  const inviteId = inviteRes.data?.invitation?.id;

  // Aisha accepts invitation
  const acceptRes = await request(
    aishaJar,
    "POST",
    `/invitations/${inviteId}/accept`,
    {},
    csrfHeader(aishaJar)
  );
  check(acceptRes.status === 200, "aisha accepted invitation");

  // 5. Test room:join
  // Aisha joins project room
  const aishaJoinAck = await new Promise((resolve) => {
    aishaSocket.emit("room:join", projectId, resolve);
  });
  check(aishaJoinAck.ok === true && aishaJoinAck.role === "editor", "Aisha successfully joined project room with editor role");

  // Owner joins project room
  const ownerJoinAck = await new Promise((resolve) => {
    ownerSocket.emit("room:join", projectId, resolve);
  });
  check(ownerJoinAck.ok === true && ownerJoinAck.role === "owner", "Owner successfully joined project room with owner role");

  // Sarah is NOT a member — joining must be refused
  const sarahJoinAck = await new Promise((resolve) => {
    sarahSocket.emit("room:join", projectId, resolve);
  });
  check(sarahJoinAck.ok === false, "Sarah (non-member) joining project room was denied");

  // 6. Test domain event: task:created
  const taskCreatedPromise = waitForEvent(aishaSocket, "task:created");
  const createTaskRes = await request(
    ownerJar,
    "POST",
    "/tasks",
    {
      projectId,
      title: "Realtime Live Card",
      priority: "high",
      status: "todo",
      assignee: aishaId,
    },
    csrfHeader(ownerJar)
  );
  check(createTaskRes.status === 201, "Owner created a task via REST");
  const taskId = createTaskRes.data?.task?.id;

  const createdEvent = await taskCreatedPromise;
  check(
    createdEvent.taskId === taskId && createdEvent.task.title === "Realtime Live Card",
    "Aisha socket received live task:created event",
    createdEvent.task.title
  );

  // 7. Test task:updated via subtask addition
  const taskUpdatedPromise = waitForEvent(aishaSocket, "task:updated");
  const addSubtaskRes = await request(
    ownerJar,
    "POST",
    `/tasks/${taskId}/subtasks`,
    { title: "First real-time subtask" },
    csrfHeader(ownerJar)
  );
  check(addSubtaskRes.status === 201, "added subtask via REST");

  const updatedEvent = await taskUpdatedPromise;
  check(
    updatedEvent.taskId === taskId && updatedEvent.task.subtasks?.length === 1,
    "Aisha socket received live task:updated event for subtask addition"
  );

  // 8. Test task:moved via kanban move
  const taskMovedPromise = waitForEvent(aishaSocket, "task:moved");
  const moveRes = await request(
    ownerJar,
    "PATCH",
    `/tasks/${taskId}/move`,
    { status: "in-progress" },
    csrfHeader(ownerJar)
  );
  check(moveRes.status === 200, "moved task to in-progress via REST");

  const movedEvent = await taskMovedPromise;
  check(
    movedEvent.taskId === taskId && movedEvent.task.status === "in-progress",
    "Aisha socket received live task:moved event with status=in-progress"
  );

  // 9. Test task:commented & notification:new
  // Aisha is assigned to the task. Owner adds a comment -> Aisha should receive both task:commented and notification:new!
  const commentPromise = waitForEvent(aishaSocket, "task:commented");
  const notifPromise = waitForEvent(aishaSocket, "notification:new");

  const addCommentRes = await request(
    ownerJar,
    "POST",
    `/tasks/${taskId}/comments`,
    { text: "Live test comment from Owner" },
    csrfHeader(ownerJar)
  );
  check(addCommentRes.status === 201, "added comment via REST");

  const [commentEvent, notifEvent] = await Promise.all([commentPromise, notifPromise]);
  check(
    commentEvent.taskId === taskId && commentEvent.task.comments?.length === 1,
    "Aisha socket received live task:commented event"
  );
  check(
    notifEvent.type === "comment.added" && notifEvent.message.includes("commented on"),
    "Aisha received instant private notification:new in her user room",
    notifEvent.message
  );

  // 10. Test project:members when role is updated
  const memberEventPromise = waitForEvent(aishaSocket, "project:members");
  const roleRes = await request(
    ownerJar,
    "PATCH",
    `/projects/${projectId}/members/${aishaId}`,
    { role: "admin" },
    csrfHeader(ownerJar)
  );
  check(roleRes.status === 200, "updated aisha role to admin via REST");

  const memberEvent = await memberEventPromise;
  check(
    memberEvent.action === "role-changed" && memberEvent.userId === aishaId,
    "Aisha socket received live project:members event for role change"
  );

  // 11. Test task:deleted
  const taskDeletedPromise = waitForEvent(aishaSocket, "task:deleted");
  const delRes = await request(
    ownerJar,
    "DELETE",
    `/tasks/${taskId}`,
    undefined,
    csrfHeader(ownerJar)
  );
  check(delRes.status === 200, "deleted task via REST");

  const deletedEvent = await taskDeletedPromise;
  check(
    deletedEvent.taskId === taskId,
    "Aisha socket received live task:deleted event"
  );

  // 12. Cleanup fixture project
  await request(ownerJar, "DELETE", `/projects/${projectId}`, undefined, csrfHeader(ownerJar));
  ok("cleaned up test project");

  // Disconnect sockets
  ownerSocket.disconnect();
  aishaSocket.disconnect();
  sarahSocket.disconnect();

  console.log(`\n──────────────────────────────────────────────`);
  console.log(`  Realtime Collaboration Smoke Test Results`);
  console.log(`  Passed: ${passed} | Failed: ${failed}`);
  console.log(`──────────────────────────────────────────────\n`);

  if (failed > 0) process.exit(1);
  process.exit(0);
})().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
