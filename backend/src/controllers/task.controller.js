const mongoose = require("mongoose");
const fs = require("fs/promises");
const path = require("path");

const Task = require("../models/Task");
const Project = require("../models/Project");
const TaskActivity = require("../models/TaskActivity");
const Activity = require("../models/Activity");
const events = require("../sockets/events");
const { UPLOAD_DIR, safeBasename } = require("../middleware/upload");
const {
  idOf,
  getProjectRole,
  canEditTasks,
  canUpdateTaskProgress,
} = require("../utils/permissions");

const notFound = (res) =>
  res.status(404).json({
    success: false,
    message: "Task not found or you don’t have access to it.",
  });

const forbidden = (res, message = "You don’t have permission to do that.") =>
  res.status(403).json({ success: false, message });

const conflict = (res, message) => res.status(409).json({ success: false, message });

const badRequest = (res, message) =>
  res.status(400).json({ success: false, message });

const PRIORITY_RANK = { low: 1, medium: 2, high: 3, urgent: 4 };

/** First N characters of a comment used as the activity summary. */
const activitySummary = (text, max = 120) =>
  String(text ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, max);

const memberNameById = (project, userId) => {
  const member = (project?.members || []).find(
    (entry) => idOf(entry.user) === String(userId)
  );
  return member?.user?.name ?? null;
};

/**
 * Append one row to the task's activity history. Never throws — history
 * must not break the action it is describing (failures are just logged).
 */
const recordActivity = async (fields) => {
  try {
    await TaskActivity.create({
      project: fields.project,
      task: fields.task,
      actor: fields.actor,
      type: fields.type,
      from: fields.from ?? null,
      to: fields.to ?? null,
      summary: fields.summary ?? "",
    });
  } catch (error) {
    console.error("activity write failed:", error.message);
  }
};

/** Normalize labels: trim, lowercase, dedupe, cap at the schema maximum. */
const normalizeLabels = (labels) => {
  if (!Array.isArray(labels)) return undefined;
  const seen = new Set();
  const out = [];
  for (const raw of labels) {
    const label = String(raw).trim().toLowerCase().slice(0, 24);
    if (!label || seen.has(label)) continue;
    seen.add(label);
    out.push(label);
    if (out.length >= 10) break;
  }
  return out;
};

/** Reject start/due date combinations that make no sense. */
const checkDates = (res, startDate, dueDate) => {
  if (startDate && dueDate && new Date(startDate) > new Date(dueDate)) {
    badRequest(res, "Start date can’t be after the due date.");
    return false;
  }
  return true;
};

const serializeTask = (task, myRole) => {
  const done = (task.subtasks || []).filter((s) => s.completed).length;
  return {
    id: task._id,
    title: task.title,
    description: task.description,
    status: task.status,
    position: task.position ?? 0,
    priority: task.priority,
    startDate: task.startDate,
    dueDate: task.dueDate,
    completedAt: task.completedAt,
    labels: task.labels || [],
    subtasks: (task.subtasks || []).map((sub) => ({
      id: sub._id,
      title: sub.title,
      completed: sub.completed,
      createdAt: sub.createdAt,
    })),
    subtaskProgress: {
      total: (task.subtasks || []).length,
      completed: done,
    },
    attachments: (task.attachments || []).map((att) => ({
      id: att._id,
      name: att.name,
      url: att.url,
      size: att.size ?? null,
      type: att.type ?? null,
      addedBy: att.addedBy
        ? {
            id: att.addedBy._id ?? att.addedBy,
            name: att.addedBy.name ?? null,
          }
        : null,
      createdAt: att.createdAt,
    })),
    comments: (task.comments || []).map((comment) => ({
      id: comment._id,
      text: comment.text,
      author: comment.author
        ? {
            id: comment.author._id ?? comment.author,
            name: comment.author.name ?? null,
          }
        : null,
      parentId: comment.parentId ?? null,
      editedAt: comment.editedAt ?? null,
      createdAt: comment.createdAt,
    })),
    commentCount: (task.comments || []).length,
    project: task.project
      ? {
          id: task.project._id ?? task.project,
          name: task.project.name ?? null,
          color: task.project.color ?? null,
          status: task.project.status ?? null,
        }
      : null,
    assignee: task.assignee
      ? {
          id: task.assignee._id ?? task.assignee,
          name: task.assignee.name ?? null,
          email: task.assignee.email ?? null,
        }
      : null,
    createdBy: task.createdBy
      ? {
          id: task.createdBy._id ?? task.createdBy,
          name: task.createdBy.name ?? null,
        }
      : null,
    members: (task.project?.members || []).map((member) => ({
      id: idOf(member.user),
      name: member.user?.name ?? null,
      email: member.user?.email ?? null,
      role: member.role,
    })),
    myRole: myRole || null,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
};

/**
 * Load a task together with its (populated) project and the requester's
 * role. Returns null when the task doesn't exist OR the requester isn't
 * a member of its project — every endpoint answers 404, so private tasks
 * never leak their existence.
 */
const loadTaskForMember = async (userId, taskId) => {
  if (!mongoose.isValidObjectId(taskId)) return null;

  const task = await Task.findById(taskId)
    .populate({
      path: "project",
      populate: [
        { path: "owner", select: "name email" },
        { path: "members.user", select: "name email" },
      ],
    })
    .populate("assignee", "name email")
    .populate("createdBy", "name")
    .populate("comments.author", "name")
    .populate("attachments.addedBy", "name")
    .lean();

  if (!task || !task.project) return null;
  const role = getProjectRole(task.project, userId);
  if (!role) return null;
  return { task, role };
};

/** Resolve + validate the target project for task creation. */
const resolveTargetProject = async (userId, projectId) => {
  if (!mongoose.isValidObjectId(projectId)) return null;
  const project = await Project.findById(projectId)
    .populate("members.user", "name email")
    .lean();
  if (!project) return null;
  const role = getProjectRole(project, userId);
  if (!role) return null;
  return { project, role };
};

/** The assignee must be a member of the task's project (or cleared). */
const isProjectMember = (project, userId) =>
  (project.members || []).some((member) => idOf(member.user) === String(userId));

const reload = async (taskId, userId) => {
  const loaded = await loadTaskForMember(userId, taskId);
  return loaded ? serializeTask(loaded.task, loaded.role) : null;
};

/**
 * GET /api/tasks
 * Search + filter + sort the requester's tasks.
 *   ?projectId=  scope to one project (membership enforced)
 *   ?q=          search title/description
 *   ?status=     todo | in-progress | in-review | done
 *   ?priority=   low | medium | high | urgent
 *   ?assignee=   me | none | <userId>
 *   ?label=      exact label (labels are stored lowercase)
 *   ?sort=       due | priority | created | title | updated | position
 *   ?order=      asc | desc
 * Due dates always sort nulls-last; priority sorts urgent→low by default.
 */
const listTasks = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      projectId,
      q,
      status,
      priority,
      assignee,
      label,
      sort = "due",
      order,
    } = req.query;

    // ----- project scope (membership enforced) -----
    let projectFilter;
    const roleByProject = new Map();

    if (projectId) {
      const target = await resolveTargetProject(userId, projectId);
      if (!target) {
        return res.status(404).json({
          success: false,
          message: "Project not found or you don’t have access to it.",
        });
      }
      projectFilter = { project: target.project._id };
      roleByProject.set(String(target.project._id), target.role);
    } else {
      // My projects only; archived projects hidden from the global list.
      const myProjects = await Project.find({
        "members.user": userId,
        status: { $ne: "archived" },
      })
        .select("_id owner members")
        .lean();
      for (const project of myProjects) {
        roleByProject.set(String(project._id), getProjectRole(project, userId));
      }
      projectFilter = {
        project: { $in: myProjects.map((p) => p._id) },
      };
    }

    // ----- filters -----
    const match = { ...projectFilter };

    if (status && Task.TASK_STATUSES.includes(status)) {
      match.status = status;
    }
    if (priority && ["low", "medium", "high", "urgent"].includes(priority)) {
      match.priority = priority;
    }
    if (label) match.labels = String(label).trim().toLowerCase();

    if (assignee === "me") match.assignee = userId;
    else if (assignee === "none") match.assignee = null;
    else if (assignee && mongoose.isValidObjectId(assignee)) {
      match.assignee = assignee;
    }

    if (q) {
      // Escape regex metacharacters so user input can't alter the pattern.
      const safe = String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (safe) match.$or = [{ title: { $regex: safe, $options: "i" } }, { description: { $regex: safe, $options: "i" } }];
    }

    const tasks = await Task.find(match)
      .sort({ createdAt: -1 })
      .limit(500)
      .populate("assignee", "name email")
      .populate("createdBy", "name")
      .populate("project", "name color status")
      .populate("comments.author", "name")
      .lean();

    // ----- sort (in memory so due dates can put nulls last) -----
    const dir = order === "desc" ? -1 : 1;
    const byDue = (a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1; // nulls always last
      if (!b.dueDate) return -1;
      return (new Date(a.dueDate) - new Date(b.dueDate)) * dir;
    };
    // asc = low → urgent, desc = urgent → low
    const byPriority = (a, b) =>
      ((PRIORITY_RANK[a.priority] || 0) - (PRIORITY_RANK[b.priority] || 0)) * dir;
    const byCreated = (a, b) =>
      (new Date(a.createdAt) - new Date(b.createdAt)) * dir;
    const byTitle = (a, b) =>
      String(a.title).localeCompare(String(b.title)) * dir;
    // Board order: ascending position inside each column (newest-first
    // tie-break keeps legacy rows that all share position 0 readable).
    const byPosition = (a, b) =>
      ((a.position ?? 0) - (b.position ?? 0)) * dir ||
      (new Date(b.createdAt) - new Date(a.createdAt)) * dir;

    const comparators = {
      due: byDue,
      priority: byPriority,
      created: byCreated,
      updated: (a, b) =>
        (new Date(a.updatedAt) - new Date(b.updatedAt)) * dir,
      title: byTitle,
      position: byPosition,
    };
    tasks.sort(comparators[sort] || byDue);

    // myRole per task (from the project scope computed above)
    const tasksOut = tasks.map((task) =>
      serializeTask(task, roleByProject.get(String(task.project?._id)) ?? null)
    );

    return res.json({ success: true, count: tasksOut.length, tasks: tasksOut });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/tasks/:id
 * Full detail incl. project members (for the assignee picker).
 */
const getTask = async (req, res, next) => {
  try {
    const loaded = await loadTaskForMember(req.user.id, req.params.id);
    if (!loaded) return notFound(res);
    return res.json({ success: true, task: serializeTask(loaded.task, loaded.role) });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/tasks
 * Create a task in a project (editor+; assignee must be a project member).
 */
const createTask = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { projectId, title, description, priority, status, assignee, startDate, dueDate } =
      req.body;

    const target = await resolveTargetProject(userId, projectId);
    if (!target) {
      return res.status(404).json({
        success: false,
        message: "Project not found or you don’t have access to it.",
      });
    }
    const { project, role } = target;
    if (!canEditTasks(role)) {
      return forbidden(res, "Viewers can’t create tasks.");
    }
    if (project.status === "archived") {
      return conflict(res, "This project is archived. Restore it before adding tasks.");
    }
    if (assignee && !isProjectMember(project, assignee)) {
      return badRequest(res, "Assignee must be a member of this project.");
    }
    if (!checkDates(res, startDate, dueDate)) return;

    const labels = normalizeLabels(req.body.labels);

    // New cards land on top of their column so board order stays intuitive.
    const top = await Task.findOne({
      project: project._id,
      status: status ?? "todo",
    })
      .sort({ position: 1 })
      .select("position")
      .lean();
    const position = top ? top.position - 1 : 0;

    const task = await Task.create({
      title,
      description: description ?? "",
      priority: priority ?? "medium",
      status: status ?? "todo",
      position,
      startDate: startDate ? new Date(startDate) : null,
      dueDate: dueDate ? new Date(dueDate) : null,
      labels: labels ?? [],
      assignee: assignee || null,
      project: project._id,
      createdBy: userId,
    });

    await recordActivity({
      project: project._id,
      task: task._id,
      actor: userId,
      type: "task-created",
      to: task.status,
      summary: activitySummary(title),
    });
    if (task.assignee) {
      await recordActivity({
        project: project._id,
        task: task._id,
        actor: userId,
        type: "task-assigned",
        to: memberNameById(project, task.assignee),
      });
    }

    const out = await reload(task._id, userId);
    // persisted → broadcast + instant notification for the new assignee
    events.taskCreated(project._id, out, userId);
    if (task.assignee) {
      events.notifyUser(task.assignee, {
        actorId: userId,
        actorName: req.user.name,
        type: "task.assigned",
        message: `assigned “${task.title}” to you`,
        projectId: project._id,
        taskId: task._id,
      });
    }
    return res.status(201).json({ success: true, task: out });
  } catch (error) {
    return next(error);
  }
};

/**
 * PATCH /api/tasks/:id
 * Edit task fields (editor+): title, description, priority, assignee,
 * start/due dates, labels. Status & subtasks have their own endpoints.
 */
const updateTask = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const loaded = await loadTaskForMember(userId, req.params.id);
    if (!loaded) return notFound(res);

    const { task, role } = loaded;
    if (!canEditTasks(role)) {
      return forbidden(res, "Viewers can’t edit tasks.");
    }
    if (task.project.status === "archived") {
      return conflict(res, "This project is archived. Restore it before editing tasks.");
    }

    const updates = {};
    if (req.body.title !== undefined) updates.title = req.body.title;
    if (req.body.description !== undefined) updates.description = req.body.description;
    if (req.body.priority !== undefined) updates.priority = req.body.priority;
    if (req.body.startDate !== undefined) {
      updates.startDate = req.body.startDate ? new Date(req.body.startDate) : null;
    }
    if (req.body.dueDate !== undefined) {
      updates.dueDate = req.body.dueDate ? new Date(req.body.dueDate) : null;
    }
    if (req.body.assignee !== undefined) {
      const nextAssignee = req.body.assignee || null;
      if (nextAssignee && !isProjectMember(task.project, nextAssignee)) {
        return badRequest(res, "Assignee must be a member of this project.");
      }
      updates.assignee = nextAssignee;
    }
    if (req.body.labels !== undefined) {
      const labels = normalizeLabels(req.body.labels);
      if (labels) updates.labels = labels;
    }

    const startDate =
      updates.startDate !== undefined ? updates.startDate : task.startDate;
    const dueDate = updates.dueDate !== undefined ? updates.dueDate : task.dueDate;
    if (!checkDates(res, startDate, dueDate)) return;

    await Task.updateOne({ _id: task._id }, { $set: updates });

    // ----- audit trail -----
    const changedFields = Object.keys(
      typeof updates.labels !== "undefined" && updates.labels === task.labels ? {} : updates
    ).filter((field) => field !== "assignee");
    if (changedFields.length > 0) {
      await recordActivity({
        project: task.project._id,
        task: task._id,
        actor: userId,
        type: "task-updated",
        summary: `changed ${changedFields.join(", ")}`,
      });
    }
    if (typeof updates.assignee !== "undefined") {
      const fromName = task.assignee ? task.assignee.name : null;
      const toName = updates.assignee ? memberNameById(task.project, updates.assignee) : null;
      if (String(updates.assignee ?? "") !== String(task.assignee?._id ?? task.assignee ?? "")) {
        await recordActivity({
          project: task.project._id,
          task: task._id,
          actor: userId,
          type: updates.assignee ? "task-assigned" : "task-unassigned",
          from: fromName,
          to: toName,
        });
      }
    }

    const out = await reload(task._id, userId);
    // persisted → broadcast + instant notification for a (re)assignee
    events.taskUpdated(task.project._id, out, userId);
    if (updates.assignee && String(updates.assignee) !== String(task.assignee?._id ?? task.assignee ?? "")) {
      events.notifyUser(updates.assignee, {
        actorId: userId,
        actorName: req.user.name,
        type: "task.assigned",
        message: `assigned “${task.title}” to you`,
        projectId: task.project._id,
        taskId: task._id,
      });
    }
    return res.json({ success: true, task: out });
  } catch (error) {
    return next(error);
  }
};

/**
 * PATCH /api/tasks/:id/status  { status }
 * Editor+ or the task's own assignee (so viewers assigned a task can
 * still report progress). completedAt is maintained here because
 * updateOne bypasses the document pre-save hook.
 */
const updateTaskStatus = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const loaded = await loadTaskForMember(userId, req.params.id);
    if (!loaded) return notFound(res);

    const { task, role } = loaded;
    if (!canUpdateTaskProgress(role, task, userId)) {
      return forbidden(res, "You can’t change the status of this task.");
    }
    if (task.project.status === "archived") {
      return conflict(res, "This project is archived. Restore it before updating tasks.");
    }

    const { status } = req.body;
    const changed = task.status !== status;
    if (changed) {
      await Task.updateOne(
        { _id: task._id },
        {
          $set: {
            status,
            completedAt: status === "done" ? new Date() : null,
          },
        }
      );
      await recordActivity({
        project: task.project._id,
        task: task._id,
        actor: userId,
        type: "task-status",
        from: task.status,
        to: status,
      });
    }

    const out = await reload(task._id, userId);
    if (changed) {
      // persisted → broadcast the column move + notify the creator on done
      events.taskMoved(task.project._id, out, userId, task.status);
      if (status === "done") {
        events.notifyUser(task.createdBy ?? null, {
          actorId: userId,
          actorName: req.user.name,
          type: "task.completed",
          message: `completed “${task.title}”`,
          projectId: task.project._id,
          taskId: task._id,
        });
      }
    }
    return res.json({ success: true, task: out });
  } catch (error) {
    return next(error);
  }
};

/**
 * PATCH /api/tasks/:id/move  { status?, orderedIds? }
 * Kanban drag & drop. The client sends the destination column and the
 * final order of that column (its slice for this task's project); the
 * server rewrites `position` for the (project, status) group so board
 * order survives a reload. Same permission as a status change:
 * editor+ or the task's own assignee.
 */
const moveTask = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const loaded = await loadTaskForMember(userId, req.params.id);
    if (!loaded) return notFound(res);

    const { task, role } = loaded;
    if (!canUpdateTaskProgress(role, task, userId)) {
      return forbidden(res, "You can’t move this task.");
    }
    if (task.project.status === "archived") {
      return conflict(res, "This project is archived. Restore it before moving tasks.");
    }

    const status = req.body.status ?? task.status;
    const orderedIds = Array.isArray(req.body.orderedIds) ? req.body.orderedIds : [];

    if (status !== task.status) {
      // updateOne bypasses the pre-save hook — maintain completedAt here.
      await Task.updateOne(
        { _id: task._id },
        { $set: { status, completedAt: status === "done" ? new Date() : null } }
      );
      await recordActivity({
        project: task.project._id,
        task: task._id,
        actor: userId,
        type: "task-status",
        from: task.status,
        to: status,
      });
    }

    // Destination column as it exists in MongoDB right now, in board order.
    const group = await Task.find({ project: task.project._id, status })
      .sort({ position: 1, createdAt: -1 })
      .select("_id position")
      .lean();
    const groupSet = new Set(group.map((row) => String(row._id)));
    const positionById = new Map(group.map((row) => [String(row._id), row.position ?? 0]));

    // Final order: what the client saw (minus ids that vanished), then the
    // moved task if the client omitted it, then anything created
    // concurrently that the client didn't know about.
    const final = [];
    const seen = new Set();
    for (const raw of orderedIds) {
      if (!mongoose.isValidObjectId(raw)) continue;
      const id = String(raw);
      if (seen.has(id) || !groupSet.has(id)) continue;
      seen.add(id);
      final.push(id);
    }
    const movedId = String(task._id);
    if (!seen.has(movedId)) final.push(movedId);
    for (const id of groupSet) {
      if (!seen.has(id)) final.push(id);
    }

    // Persist only the rows whose index actually moved (keeps updatedAt
    // stable for untouched cards).
    const ops = final
      .map((id, index) => ({ id, index }))
      .filter(({ id, index }) => positionById.get(id) !== index)
      .map(({ id, index }) => ({
        updateOne: { filter: { _id: id }, update: { $set: { position: index } } },
      }));
    if (ops.length > 0) await Task.bulkWrite(ops);

    const out = await reload(task._id, userId);
    // persisted → broadcast the drag & drop
    events.taskMoved(task.project._id, out, userId, task.status);
    return res.json({ success: true, task: out });
  } catch (error) {
    return next(error);
  }
};

/**
 * DELETE /api/tasks/:id — editor+ (archived projects: blocked).
 */
const deleteTask = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const loaded = await loadTaskForMember(userId, req.params.id);
    if (!loaded) return notFound(res);

    const { task, role } = loaded;
    if (!canEditTasks(role)) {
      return forbidden(res, "Viewers can’t delete tasks.");
    }
    if (task.project.status === "archived") {
      return conflict(res, "This project is archived. Restore it before deleting tasks.");
    }

    await Task.deleteOne({ _id: task._id });
    await TaskActivity.deleteMany({ task: task._id }).catch(() => {}); // history dies with the task
    // persisted → broadcast (sockets in the room drop the card instantly)
    events.taskDeleted(task.project._id, task._id, userId);
    return res.json({ success: true, message: "Task deleted." });
  } catch (error) {
    return next(error);
  }
};

// ---------- subtasks ----------

const addSubtask = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const loaded = await loadTaskForMember(userId, req.params.id);
    if (!loaded) return notFound(res);

    const { task, role } = loaded;
    if (!canUpdateTaskProgress(role, task, userId)) {
      return forbidden(res, "You can’t modify this task’s subtasks.");
    }
    if (task.project.status === "archived") {
      return conflict(res, "This project is archived.");
    }
    if ((task.subtasks || []).length >= 50) {
      return conflict(res, "This task already has 50 subtasks.");
    }

    await Task.updateOne(
      { _id: task._id },
      { $push: { subtasks: { title: req.body.title, completed: false } } }
    );

    const out = await reload(task._id, userId);
    events.taskUpdated(task.project._id, out, userId);
    return res.status(201).json({ success: true, task: out });
  } catch (error) {
    return next(error);
  }
};

const updateSubtask = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const loaded = await loadTaskForMember(userId, req.params.id);
    if (!loaded) return notFound(res);

    const { task, role } = loaded;
    if (!canUpdateTaskProgress(role, task, userId)) {
      return forbidden(res, "You can’t modify this task’s subtasks.");
    }
    if (task.project.status === "archived") {
      return conflict(res, "This project is archived.");
    }

    const subtask = (task.subtasks || []).find(
      (s) => String(s._id) === String(req.params.subId)
    );
    if (!subtask) return notFound(res);

    const updates = {};
    if (req.body.completed !== undefined) updates["subtasks.$.completed"] = Boolean(req.body.completed);
    if (req.body.title !== undefined) updates["subtasks.$.title"] = req.body.title;

    await Task.updateOne(
      { _id: task._id, "subtasks._id": req.params.subId },
      { $set: updates }
    );

    const out = await reload(task._id, userId);
    events.taskUpdated(task.project._id, out, userId);
    return res.json({ success: true, task: out });
  } catch (error) {
    return next(error);
  }
};

const removeSubtask = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const loaded = await loadTaskForMember(userId, req.params.id);
    if (!loaded) return notFound(res);

    const { task, role } = loaded;
    if (!canUpdateTaskProgress(role, task, userId)) {
      return forbidden(res, "You can’t modify this task’s subtasks.");
    }
    if (task.project.status === "archived") {
      return conflict(res, "This project is archived.");
    }

    await Task.updateOne(
      { _id: task._id },
      { $pull: { subtasks: { _id: req.params.subId } } }
    );

    const out = await reload(task._id, userId);
    events.taskUpdated(task.project._id, out, userId);
    return res.json({ success: true, task: out });
  } catch (error) {
    return next(error);
  }
};

// ---------- attachments (links + uploaded files) ----------

/** Delete an uploaded file's blob on disk (best effort). */
const unlinkUpload = async (url) => {
  if (typeof url !== "string" || !url.startsWith("/uploads/")) return;
  const name = path.basename(url);
  // Only delete inside the uploads dir — random name + extension, no paths.
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name)) return;
  await fs.unlink(path.join(UPLOAD_DIR, name)).catch(() => {});
};

/** Shared permission check for adding files/links to a task. */
const canManageAttachments = (role, task, userId) =>
  canEditTasks(role) ||
  (Boolean(task.assignee) && String(idOf(task.assignee)) === String(userId));

const addAttachment = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const loaded = await loadTaskForMember(userId, req.params.id);
    if (!loaded) return notFound(res);

    const { task, role } = loaded;
    if (!canManageAttachments(role, task, userId)) {
      return forbidden(res, "You can’t add attachments to this task.");
    }
    if (task.project.status === "archived") {
      return conflict(res, "This project is archived.");
    }
    if ((task.attachments || []).length >= 20) {
      return conflict(res, "This task already has 20 attachments.");
    }

    const name = (req.body.name || "").trim();
    await Task.updateOne(
      { _id: task._id },
      {
        $push: {
          attachments: {
            url: req.body.url,
            name,
            addedBy: userId,
          },
        },
      }
    );

    await recordActivity({
      project: task.project._id,
      task: task._id,
      actor: userId,
      type: "attachment-added",
      to: name || req.body.url,
    });

    const out = await reload(task._id, userId);
    events.taskUpdated(task.project._id, out, userId);
    return res.status(201).json({ success: true, task: out });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/tasks/:id/attachments/upload — multipart file upload.
 * Editor+ or the task's assignee. The stored URL is `/uploads/<random>`,
 * served statically; the display name comes from the uploaded filename
 * (overridable via the optional `name` form field).
 */
const uploadAttachment = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const loaded = await loadTaskForMember(userId, req.params.id);
    if (!loaded) return notFound(res);

    const { task, role } = loaded;
    if (!canManageAttachments(role, task, userId)) {
      return forbidden(res, "You can’t add attachments to this task.");
    }
    if (task.project.status === "archived") {
      return conflict(res, "This project is archived. Restore it before uploading.");
    }
    if ((task.attachments || []).length >= 20) {
      return conflict(res, "This task already has 20 attachments.");
    }
    if (!req.file) {
      return badRequest(
        res,
        "No file received — pick a supported file type (or it was too large)."
      );
    }

    const name =
      safeBasename(req.body.name || "") ||
      safeBasename(req.file.originalname) ||
      "file";
    const url = `/uploads/${req.file.filename}`;

    await Task.updateOne(
      { _id: task._id },
      {
        $push: {
          attachments: {
            url,
            name,
            size: req.file.size,
            type: req.file.mimetype || null,
            addedBy: userId,
          },
        },
      }
    );

    await recordActivity({
      project: task.project._id,
      task: task._id,
      actor: userId,
      type: "attachment-added",
      to: name,
    });

    const out = await reload(task._id, userId);
    events.taskUpdated(task.project._id, out, userId);
    return res.status(201).json({ success: true, task: out });
  } catch (error) {
    return next(error);
  }
};

const removeAttachment = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const loaded = await loadTaskForMember(userId, req.params.id);
    if (!loaded) return notFound(res);

    const { task, role } = loaded;
    const attachment = (task.attachments || []).find(
      (att) => String(att._id) === String(req.params.attachmentId)
    );
    if (!attachment) return notFound(res);
    if (!canEditTasks(role)) {
      return forbidden(res, "Viewers can’t remove attachments.");
    }
    if (task.project.status === "archived") {
      return conflict(res, "This project is archived.");
    }

    await Task.updateOne(
      { _id: task._id },
      { $pull: { attachments: { _id: req.params.attachmentId } } }
    );
    await unlinkUpload(attachment.url);

    await recordActivity({
      project: task.project._id,
      task: task._id,
      actor: userId,
      type: "attachment-removed",
      from: attachment.name || attachment.url,
    });

    const out = await reload(task._id, userId);
    events.taskUpdated(task.project._id, out, userId);
    return res.json({ success: true, task: out });
  } catch (error) {
    return next(error);
  }
};

// ---------- comments (threaded: parentId for one level of replies) ----------

/**
 * GET /api/tasks/:id/activity — the task's history, newest first.
 * Any project member (same rule as GET /api/tasks/:id).
 */
const getTaskActivity = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const loaded = await loadTaskForMember(userId, req.params.id);
    if (!loaded) return notFound(res);

    const limit = Math.min(
      Math.max(Number(req.query.limit) || 100, 1),
      200
    );
    const activity = await TaskActivity.find({ task: loaded.task._id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("actor", "name email")
      .lean();

    return res.json({
      success: true,
      count: activity.length,
      activity: activity.map((entry) => ({
        id: entry._id,
        type: entry.type,
        from: entry.from ?? null,
        to: entry.to ?? null,
        summary: entry.summary ?? "",
        actor: entry.actor
          ? { id: entry.actor._id, name: entry.actor.name, email: entry.actor.email }
          : null,
        createdAt: entry.createdAt,
      })),
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/tasks/:id/comments  { text, parentId? }
 * Any project member may comment (viewers included). `parentId` starts a
 * reply — it must reference a top-level comment of this task.
 */
const addComment = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const loaded = await loadTaskForMember(userId, req.params.id);
    if (!loaded) return notFound(res);
    const { task } = loaded;
    if (task.project.status === "archived") {
      return conflict(res, "This project is archived. Restore it before commenting.");
    }
    if ((task.comments || []).length >= Task.MAX_COMMENTS) {
      return conflict(res, `This task already has ${Task.MAX_COMMENTS} comments.`);
    }

    // Reply target must exist inside this task and be a top-level comment.
    const parentId = req.body.parentId ?? null;
    if (parentId !== null) {
      if (!mongoose.isValidObjectId(parentId)) {
        return badRequest(res, "Invalid reply target.");
      }
      const parent = (task.comments || []).find(
        (entry) => String(entry._id) === String(parentId)
      );
      if (!parent) return badRequest(res, "Reply target not found on this task.");
      if (parent.parentId) {
        return badRequest(res, "Replies can only be added to top-level comments.");
      }
    }

    await Task.updateOne(
      { _id: task._id },
      {
        $push: {
          comments: {
            text: req.body.text,
            author: userId,
            parentId: parentId ?? null,
          },
        },
      }
    );

    await recordActivity({
      project: task.project._id,
      task: task._id,
      actor: userId,
      type: "comment-added",
      summary: activitySummary(req.body.text),
    });

    const out = await reload(task._id, userId);
    const newComment = (out.comments || []).slice(-1)[0];
    events.taskCommented(task.project._id, out, newComment?._id, userId);
    if (task.assignee && String(idOf(task.assignee)) !== String(userId)) {
      events.notifyUser(task.assignee, {
        actorId: userId,
        actorName: req.user.name,
        type: "comment.added",
        message: `commented on “${task.title}”`,
        projectId: task.project._id,
        taskId: task._id,
      });
    }
    return res.status(201).json({ success: true, task: out });
  } catch (error) {
    return next(error);
  }
};

/**
 * PATCH /api/tasks/:id/comments/:commentId  { text }
 * Only the comment's author may edit their own comment.
 */
const editComment = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const loaded = await loadTaskForMember(userId, req.params.id);
    if (!loaded) return notFound(res);
    const { task } = loaded;
    if (task.project.status === "archived") {
      return conflict(res, "This project is archived. Restore it before editing comments.");
    }

    const comment = (task.comments || []).find(
      (entry) => String(entry._id) === String(req.params.commentId)
    );
    if (!comment) return notFound(res);

    const isAuthor = String(comment.author?._id ?? comment.author) === String(userId);
    if (!isAuthor) {
      return forbidden(res, "You can only edit your own comments.");
    }

    await Task.updateOne(
      { _id: task._id, "comments._id": req.params.commentId },
      { $set: { "comments.$.text": req.body.text, "comments.$.editedAt": new Date() } }
    );

    await recordActivity({
      project: task.project._id,
      task: task._id,
      actor: userId,
      type: "comment-edited",
      summary: activitySummary(req.body.text),
    });

    const out = await reload(task._id, userId);
    events.taskCommented(task.project._id, out, req.params.commentId, userId);
    return res.json({ success: true, task: out });
  } catch (error) {
    return next(error);
  }
};

/**
 * DELETE /api/tasks/:id/comments/:commentId
 * The comment's author may delete their own; editors+ may delete any.
 * Deleting a top-level comment also removes its replies.
 */
const removeComment = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const loaded = await loadTaskForMember(userId, req.params.id);
    if (!loaded) return notFound(res);
    const { task } = loaded;
    if (task.project.status === "archived") {
      return conflict(res, "This project is archived. Restore it before editing comments.");
    }

    const comment = (task.comments || []).find(
      (entry) => String(entry._id) === String(req.params.commentId)
    );
    if (!comment) return notFound(res);

    const isAuthor = String(comment.author?._id ?? comment.author) === String(userId);
    if (!isAuthor && !canEditTasks(loaded.role)) {
      return forbidden(res, "You can only delete your own comments.");
    }

    // Pull the comment AND, for top-level comments, all its replies.
    await Task.updateOne(
      { _id: task._id },
      {
        $pull: {
          comments: {
            $or: [{ _id: req.params.commentId }, { parentId: req.params.commentId }],
          },
        },
      }
    );

    await recordActivity({
      project: task.project._id,
      task: task._id,
      actor: userId,
      type: "comment-deleted",
      summary: activitySummary(comment.text),
    });

    const out = await reload(task._id, userId);
    events.taskCommented(task.project._id, out, req.params.commentId, userId);
    return res.json({ success: true, task: out });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listTasks,
  getTask,
  createTask,
  updateTask,
  updateTaskStatus,
  moveTask,
  deleteTask,
  addSubtask,
  updateSubtask,
  removeSubtask,
  addAttachment,
  uploadAttachment,
  removeAttachment,
  getTaskActivity,
  addComment,
  editComment,
  removeComment,
};
