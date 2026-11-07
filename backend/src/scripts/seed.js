/**
 * Seed realistic demo data for the WorkFlow dashboard.
 *
 * Usage:
 *   npm run seed                     # demo user: demo@workflow.app / Demo@1234
 *   npm run seed -- --reset          # wipe the user's data first, then reseed
 *   npm run seed -- --email you@x.com --reset
 *
 * Creates: 5 active projects + 1 archived, 35 tasks across todo /
 * in-progress / in-review / done (with spread-out due dates and completion
 * times), teammate users, and an activity feed.
 */
require("dotenv").config();

const mongoose = require("mongoose");
const { connectDB, disconnectDB } = require("../config/db");
const User = require("../models/User");
const Project = require("../models/Project");
const Task = require("../models/Task");
const Activity = require("../models/Activity");
const Invitation = require("../models/Invitation");

const args = process.argv.slice(2);
const getArg = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};
const email = getArg("--email", "demo@workflow.app");
const password = getArg("--password", "Demo@1234");
const displayName = getArg("--name", "Demo User");
const reset = args.includes("--reset");

/** Date `n` days from now at local noon (avoids timezone edges). */
const day = (n) => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d;
};

/** Date `n` days ago, current time. */
const daysAgo = (n, hour = 10) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, (n * 17) % 60, 0, 0);
  return d;
};

// ---------- seed definitions ----------
const PROJECT_DEFS = [
  {
    key: "redesign",
    name: "Website Redesign",
    description: "Refresh the marketing site with the new brand system.",
    color: "indigo",
    status: "active",
    dueDate: day(12),
    members: ["aisha", "rahul"],
  },
  {
    key: "mobile",
    name: "Mobile App Launch",
    description: "Ship the v1 mobile app to the iOS and Android stores.",
    color: "blue",
    status: "active",
    dueDate: day(25),
    members: ["rahul"],
  },
  {
    key: "marketing",
    name: "Q4 Marketing Campaign",
    description: "Plan and launch the holiday product campaign.",
    color: "emerald",
    status: "active",
    dueDate: day(18),
    members: ["aisha", "rahul"],
  },
  {
    key: "portal",
    name: "Customer Portal",
    description: "Self-service portal for accounts and billing management.",
    color: "amber",
    status: "on-hold",
    dueDate: day(30),
    members: ["rahul", "aisha"],
  },
  {
    key: "api",
    name: "API v2 Platform",
    description: "Next-generation public API with versioning and quotas.",
    color: "sky",
    status: "active",
    dueDate: null,
    members: ["rahul"],
  },
  {
    key: "legacy",
    name: "Legacy Site Cleanup",
    description: "Archive and redirect pages from the old website.",
    color: "rose",
    status: "archived",
    dueDate: null,
    members: [],
  },
];

// assignee: "me" = the demo user, others = teammates
const TASK_DEFS = [
  // --- Website Redesign (8) ---
  { p: "redesign", title: "Audit current site pages", status: "done", priority: "high", completed: 5, assignee: "me" },
  { p: "redesign", title: "Finalize brand style guide", status: "done", priority: "medium", completed: 2, assignee: "me" },
  { p: "redesign", title: "Design new landing page (Figma)", status: "done", priority: "high", completed: 1, assignee: "aisha" },
  { p: "redesign", title: "Build homepage prototype", status: "done", priority: "high", completed: 3, assignee: "rahul" },
  { p: "redesign", title: "Set up design tokens in Tailwind", status: "done", priority: "medium", completed: 4, assignee: "me" },
  { p: "redesign", title: "Implement pricing page", status: "in-progress", priority: "high", due: 2, assignee: "me" },
  { p: "redesign", title: "Migrate blog content", status: "todo", priority: "low", due: -2, assignee: "me" },
  { p: "redesign", title: "Cross-browser QA pass", status: "in-review", priority: "medium", due: 5, assignee: "me" },

  // --- Mobile App Launch (7) ---
  { p: "mobile", title: "Define v1 feature scope", status: "done", priority: "medium", completed: 2, assignee: "me" },
  { p: "mobile", title: "Set up CI pipeline", status: "done", priority: "high", completed: 0, assignee: "me" },
  { p: "mobile", title: "App store assets ready", status: "done", priority: "low", completed: 1, assignee: "aisha" },
  { p: "mobile", title: "Beta build for testers", status: "in-progress", priority: "urgent", due: -1, assignee: "rahul" },
  { p: "mobile", title: "Push notification service", status: "in-progress", priority: "high", due: 3, assignee: "me" },
  { p: "mobile", title: "Onboarding flow screens", status: "todo", priority: "medium", due: 7, assignee: "me" },
  { p: "mobile", title: "Release notes draft", status: "todo", priority: "low", due: 10, assignee: "me" },

  // --- Q4 Marketing Campaign (6) ---
  { p: "marketing", title: "Campaign brief approved", status: "done", priority: "medium", completed: 1, assignee: "me" },
  { p: "marketing", title: "Landing page copy", status: "done", priority: "high", completed: 2, assignee: "aisha" },
  { p: "marketing", title: "Email sequence (5 emails)", status: "done", priority: "medium", completed: 3, assignee: "me" },
  { p: "marketing", title: "Social calendar Nov–Dec", status: "done", priority: "low", completed: 4, assignee: "rahul" },
  { p: "marketing", title: "Produce launch video", status: "in-review", priority: "high", due: 4, assignee: "me" },
  { p: "marketing", title: "Partner co-marketing emails", status: "todo", priority: "medium", due: 12, assignee: "me" },

  // --- Customer Portal (6) ---
  { p: "portal", title: "Requirements workshop", status: "done", priority: "medium", completed: 8, assignee: "me" },
  { p: "portal", title: "Data model for accounts/billing", status: "in-progress", priority: "high", due: -3, assignee: "me" },
  { p: "portal", title: "Billing provider research", status: "in-progress", priority: "medium", due: 9, assignee: "rahul" },
  { p: "portal", title: "Portal UI wireframes", status: "in-review", priority: "medium", due: 14, assignee: "aisha" },
  { p: "portal", title: "SSO integration plan", status: "todo", priority: "low", due: 21, assignee: "me" },
  { p: "portal", title: "Support ticket routing rules", status: "todo", priority: "low", due: null, assignee: "me" },

  // --- API v2 Platform (6) ---
  { p: "api", title: "API contract draft", status: "done", priority: "high", completed: 2, assignee: "me" },
  { p: "api", title: "Versioning strategy doc", status: "done", priority: "low", completed: 2, assignee: "rahul" },
  { p: "api", title: "Rate limiting middleware", status: "done", priority: "medium", completed: 14, assignee: "me" },
  { p: "api", title: "WebSocket auth handshake", status: "in-progress", priority: "urgent", due: 1, assignee: "me" },
  { p: "api", title: "Deprecation plan for v1", status: "todo", priority: "medium", due: 6, assignee: "me" },
  { p: "api", title: "Load testing scenarios", status: "todo", priority: "low", due: -5, assignee: "me" },

  // --- Legacy Site Cleanup (archived — excluded from dashboard stats) ---
  { p: "legacy", title: "Take down legacy pages", status: "done", priority: "medium", completed: 20, assignee: "me" },
  { p: "legacy", title: "Redirect map spreadsheet", status: "todo", priority: "low", due: 3, assignee: "me" },
];

async function main() {
  await connectDB();

  // ---------- users ----------
  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({ name: displayName, email, password, role: "admin" });
    console.log(`✅ Created user ${email} (password: ${password})`);
  } else {
    console.log(`👤 Using existing user ${email}`);
  }

  const teammateDefs = [
    { key: "aisha", name: "Aisha Khan", email: "aisha@workflow.app" },
    { key: "rahul", name: "Rahul Mehta", email: "rahul@workflow.app" },
    { key: "sarah", name: "Sarah Lee", email: "sarah@workflow.app" },
  ];
  const people = { me: user };
  for (const t of teammateDefs) {
    let teammate = await User.findOne({ email: t.email });
    if (!teammate) {
      teammate = await User.create({
        name: t.name,
        email: t.email,
        password: "Teammate@123",
        role: "member",
      });
    }
    people[t.key] = teammate;
  }
  console.log(`👥 Workspace people: ${Object.values(people).map((p) => p.name).join(", ")}`);

  // ---------- reset (optional) ----------
  // Match by owner OR membership: legacy projects stored members as plain
  // ObjectIds, which `members.user` queries silently miss.
  const existingProjects = await Project.find({
    $or: [{ owner: user._id }, { "members.user": user._id }],
  }).select("_id");
  if (existingProjects.length > 0 && !reset) {
    console.log(
      "\n⚠️  This user already has projects. Re-run with --reset to wipe and reseed:\n" +
        "    npm run seed -- --reset"
    );
    await disconnectDB();
    return;
  }
  if (reset) {
    const ids = existingProjects.map((p) => p._id);
    const [p, t, a, i] = await Promise.all([
      Project.deleteMany({ _id: { $in: ids } }),
      Task.deleteMany({ project: { $in: ids } }),
      Activity.deleteMany({ user: user._id }),
      Invitation.deleteMany({ project: { $in: ids } }),
    ]);
    console.log(
      `🧹 Reset removed ${p.deletedCount} projects, ${t.deletedCount} tasks, ${a.deletedCount} activities, ${i.deletedCount} invitations`
    );
    // Safety sweep: remove tasks whose project no longer exists (orphans
    // left behind by older runs or legacy schemas).
    const aliveIds = (await Project.find({}).select("_id")).map((pr) => pr._id);
    const orphans = await Task.deleteMany({ project: { $nin: aliveIds } });
    if (orphans.deletedCount > 0) {
      console.log(`🧽 Removed ${orphans.deletedCount} orphaned tasks`);
    }
  }

  // ---------- projects ----------
  const projects = {};
  for (const def of PROJECT_DEFS) {
    const project = await Project.create({
      name: def.name,
      description: def.description,
      color: def.color,
      status: def.status,
      dueDate: def.dueDate,
      owner: user._id,
      members: [
        { user: user._id, role: "owner" },
        ...def.members.map((m) => ({ user: people[m]._id, role: "editor" })),
      ],
    });
    projects[def.key] = project;
  }
  console.log(`📁 Created ${PROJECT_DEFS.length} projects (${PROJECT_DEFS.filter((p) => p.status !== "archived").length} visible, 1 archived)`);

  // ---------- tasks ----------
  const doneTasks = [];
  const createdTaskIds = new Map();
  // Board order: position increments per (project, status) column, so the
  // Kanban shows TASK_DEFS order inside each column out of the box.
  const nextPosition = new Map();
  for (const def of TASK_DEFS) {
    const project = projects[def.p];
    const columnKey = `${project._id}:${def.status}`;
    const position = nextPosition.get(columnKey) ?? 0;
    nextPosition.set(columnKey, position + 1);

    const task = await Task.create({
      title: def.title,
      description: "",
      status: def.status,
      position,
      priority: def.priority,
      dueDate: def.due ? day(def.due) : null,
      project: project._id,
      assignee: people[def.assignee]._id,
      createdBy: user._id,
    });
    createdTaskIds.set(def.title, task._id);
    if (def.status === "done" && def.completed !== undefined) {
      doneTasks.push({ id: task._id, completed: def.completed });
    }
  }
  // Spread completion times across the past (drives the weekly chart).
  await Promise.all(
    doneTasks.map((t) =>
      Task.updateOne({ _id: t.id }, { $set: { completedAt: daysAgo(t.completed) } })
    )
  );
  console.log(`✅ Created ${TASK_DEFS.length} tasks (${doneTasks.length} done)`);

  // ---------- task enrichment: labels, subtasks, start dates, attachments ----------
  // (updates existing tasks only — dashboard totals stay unchanged)
  const dayStr = (n) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d;
  };
  const ENRICH = [
    {
      title: "Implement pricing page",
      labels: ["frontend", "billing"],
      startDate: dayStr(-4),
      subtasks: [
        { title: "Add tier comparison table", completed: true },
        { title: "Wire checkout buttons", completed: false },
        { title: "Mobile layout pass", completed: false },
      ],
      attachments: [
        { name: "Pricing mockup (Figma)", url: "https://www.figma.com/file/pricing-mockup" },
      ],
      comments: [
        { by: "aisha", text: "Tier table looks great — can we match the spacing from the Figma?", ago: 2 },
        { by: "me", text: "Updated in the latest commit, ready for another look.", ago: 1 },
      ],
    },
    {
      title: "Migrate blog content",
      labels: ["content"],
      subtasks: [
        { title: "Export old posts", completed: false },
        { title: "Fix image paths", completed: false },
      ],
      comments: [
        { by: "rahul", text: "301 redirects are wired up for the old slugs.", ago: 3 },
      ],
    },
    {
      title: "Cross-browser QA pass",
      labels: ["qa", "frontend"],
      subtasks: [
        { title: "Chrome + Edge", completed: true },
        { title: "Safari", completed: false },
        { title: "Firefox", completed: false },
      ],
      comments: [
        { by: "me", text: "Safari has a rendering glitch on the pricing table — filing a ticket.", ago: 1 },
      ],
    },
    {
      title: "Beta build for testers",
      labels: ["release", "mobile"],
      startDate: dayStr(-6),
      subtasks: [
        { title: "Bump build version", completed: true },
        { title: "Upload to TestFlight", completed: false },
        { title: "Notify the beta list", completed: false },
      ],
      attachments: [
        { name: "Release checklist", url: "https://www.notion.so/release-checklist" },
      ],
      comments: [
        { by: "rahul", text: "Build 42 is on TestFlight now, waiting on Apple review.", ago: 1 },
      ],
    },
    {
      title: "Push notification service",
      labels: ["backend", "mobile"],
      subtasks: [
        { title: "Register APNs credentials", completed: true },
        { title: "Register FCM credentials", completed: false },
        { title: "Daily digest job", completed: false },
      ],
    },
    {
      title: "Onboarding flow screens",
      labels: ["design", "mobile"],
      subtasks: [
        { title: "Welcome screen", completed: false },
        { title: "Permissions prompt", completed: false },
        { title: "Feature tour", completed: false },
      ],
    },
    {
      title: "Produce launch video",
      labels: ["video", "campaign"],
      startDate: dayStr(-2),
      attachments: [
        { name: "Storyboard", url: "https://www.figma.com/file/launch-storyboard" },
      ],
      comments: [
        { by: "aisha", text: "First cut is in — feedback welcome before Friday.", ago: 2 },
        { by: "me", text: "Music swap requested, everything else looks good.", ago: 1 },
      ],
    },
    {
      title: "Data model for accounts/billing",
      labels: ["backend", "billing"],
      subtasks: [
        { title: "Accounts table", completed: true },
        { title: "Invoices table", completed: false },
        { title: "Migration script", completed: false },
      ],
    },
    {
      title: "WebSocket auth handshake",
      labels: ["api", "realtime"],
      startDate: dayStr(-3),
      subtasks: [
        { title: "Token exchange", completed: true },
        { title: "Reconnect logic", completed: false },
      ],
      attachments: [
        { name: "Handshake notes", url: "https://example.com/ws-auth-notes" },
      ],
      comments: [
        { by: "rahul", text: "Token refresh flow works on reconnect now.", ago: 1 },
      ],
    },
    {
      title: "Load testing scenarios",
      labels: ["qa", "api"],
      subtasks: [
        { title: "Spike test plan", completed: false },
        { title: "Soak test plan", completed: false },
      ],
    },
  ];
  await Promise.all(
    ENRICH.map((def) => {
      const $set = { labels: def.labels || [] };
      if (def.startDate) $set.startDate = def.startDate;
      if (def.subtasks) $set.subtasks = def.subtasks.map((s, i) => ({ ...s, _id: new mongoose.Types.ObjectId(), createdAt: daysAgo(9 - i) }));
      if (def.attachments) $set.attachments = def.attachments.map((a, i) => ({ ...a, addedBy: user._id, _id: new mongoose.Types.ObjectId(), createdAt: daysAgo(6 - i) }));
      if (def.comments) {
        $set.comments = def.comments.map((c, i) => ({
          text: c.text,
          author: people[c.by]._id,
          _id: new mongoose.Types.ObjectId(),
          createdAt: daysAgo(c.ago ?? 3, 9 + i * 2),
        }));
      }
      // Target the exact doc created in THIS run — title-only matching can
      // hit stale duplicates left by older seeds.
      const id = createdTaskIds.get(def.title);
      if (!id) {
        console.warn(`⚠️  ENRICH: no freshly created task titled "${def.title}"`);
        return null;
      }
      return Task.updateOne({ _id: id }, { $set });
    })
  );
  console.log(`🎨 Enriched ${ENRICH.length} tasks with labels, subtasks, attachments & comments`);

  // ---------- activity feed (manual timestamps via the native driver) ----------
  const activityDefs = [
    { actor: "me", type: "project.created", message: "created project “Website Redesign”", at: daysAgo(11, 9) },
    { actor: "me", type: "project.created", message: "created project “Mobile App Launch”", at: daysAgo(10, 11) },
    { actor: "me", type: "project.created", message: "created project “Q4 Marketing Campaign”", at: daysAgo(9, 14) },
    { actor: "me", type: "project.created", message: "created project “Customer Portal”", at: daysAgo(9, 16) },
    { actor: "me", type: "project.created", message: "created project “API v2 Platform”", at: daysAgo(8, 10) },
    { actor: "sarah", type: "comment.added", message: "commented on “Campaign brief approved”", at: daysAgo(7, 15) },
    { actor: "rahul", type: "member.joined", message: "joined “API v2 Platform”", at: daysAgo(6, 12) },
    { actor: "me", type: "task.assigned", message: "assigned “Beta build for testers” to Rahul", at: daysAgo(5, 13) },
    { actor: "aisha", type: "task.assigned", message: "assigned “Portal UI wireframes” to herself", at: daysAgo(4, 10) },
    { actor: "rahul", type: "task.completed", message: "completed “Build homepage prototype”", at: daysAgo(3, 16) },
    { actor: "rahul", type: "task.completed", message: "completed “Social calendar Nov–Dec”", at: daysAgo(2, 11) },
    { actor: "aisha", type: "task.completed", message: "completed “App store assets ready”", at: daysAgo(1, 17) },
  ];
  await Activity.collection.insertMany(
    activityDefs.map((def) => ({
      user: user._id,
      actor: people[def.actor]._id,
      type: def.type,
      message: def.message,
      project: null,
      createdAt: def.at,
      updatedAt: def.at,
    }))
  );
  console.log(`🕒 Created ${activityDefs.length} activity entries`);

  // ---------- expected dashboard numbers ----------
  const visibleIds = PROJECT_DEFS.filter((p) => p.status !== "archived").map((p) => projects[p.key]._id);
  const visibleTasks = await Task.find({ project: { $in: visibleIds } }).lean();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const done = visibleTasks.filter((t) => t.status === "done").length;
  const overdue = visibleTasks.filter(
    (t) => t.status !== "done" && t.dueDate && t.dueDate < today
  ).length;

  console.log("\n📊 Expected dashboard numbers:");
  console.log(`   Total projects:    ${visibleIds.length} (archived excluded)`);
  console.log(`   Total tasks:       ${visibleTasks.length}`);
  console.log(`   Completed tasks:   ${done} (${Math.round((done / visibleTasks.length) * 100)}%)`);
  console.log(`   Overdue tasks:     ${overdue}`);
  console.log(`\n🔐 Log in at http://localhost:5173/login → ${email} / ${password}\n`);

  await disconnectDB();
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
