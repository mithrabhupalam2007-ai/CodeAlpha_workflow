import { useEffect, useState } from "react";
import {
  Check,
  MessageSquare,
  Pencil,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

import { addComment, editComment, removeComment } from "../../api/tasks.js";
import { initialsOf, relativeTime } from "../../utils/dates.js";
import { canEditTasks } from "../../utils/permissions.js";
import { cn } from "../../utils/cn.js";

const DRAFT_CLASS =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 transition-all focus:border-brand-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/10";

const Avatar = ({ name }) => (
  <span
    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-[10px] font-bold text-white"
    title={name ?? "Someone"}
  >
    {initialsOf(name ?? "?")}
  </span>
);

/** One comment (plus its replies) in the task discussion. */
function CommentItem({ comment, replies, user, canEditTask, busy, onDone, onError }) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyDraft, setReplyDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState("");
  const [deleting, setDeleting] = useState(false);

  const mine = comment.author?.id === user?.id;
  const canDelete = canEditTask || mine;

  const submitReply = async (event) => {
    event.preventDefault();
    const text = replyDraft.trim();
    if (!text) return;
    await onDone(() => addComment(comment.taskId, text, comment.id));
    setReplyDraft("");
    setReplyOpen(false);
  };

  const submitEdit = async (event) => {
    event.preventDefault();
    const text = editDraft.trim();
    if (!text) return;
    await onDone(() => editComment(comment.taskId, comment.id, text));
    setEditing(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    const outcome = await onDone(() => removeComment(comment.taskId, comment.id));
    setDeleting(false);
    if (!outcome.ok) setDeleting(false);
  };

  return (
    <li className="group flex items-start gap-2.5">
      <Avatar name={comment.author?.name} />
      <div className="min-w-0 flex-1">
        {/* Author + time + actions */}
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-xs font-semibold text-slate-800">
            {comment.author?.name ?? "Someone"}
          </span>
          <span
            className="text-[10px] text-slate-400"
            title={new Date(comment.createdAt).toLocaleString()}
          >
            {relativeTime(comment.createdAt)}
          </span>
          {comment.editedAt ? (
            <span
              className="text-[10px] italic text-slate-400"
              title={`Edited ${new Date(comment.editedAt).toLocaleString()}`}
            >
              (edited)
            </span>
          ) : null}

          {!editing && !busy && !deleting ? (
            <span className="ml-auto flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
              <button
                type="button"
                onClick={() => {
                  setReplyOpen((prev) => !prev);
                  setEditing(false);
                }}
                aria-label="Reply to comment"
                title="Reply"
                className="rounded-md p-1 text-slate-300 transition-colors hover:bg-brand-50 hover:text-brand-600"
              >
                <MessageSquare className="h-3.5 w-3.5" />
              </button>
              {mine ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditing(true);
                    setEditDraft(comment.text);
                    setReplyOpen(false);
                  }}
                  aria-label="Edit comment"
                  title="Edit your comment"
                  className="rounded-md p-1 text-slate-300 transition-colors hover:bg-brand-50 hover:text-brand-600"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              ) : null}
              {canDelete ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  aria-label="Delete comment"
                  title={canEditTask ? "Delete comment" : "Delete your comment"}
                  className="rounded-md p-1 text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </span>
          ) : null}
        </p>

        {/* Body / inline edit */}
        {editing ? (
          <form onSubmit={submitEdit} className="mt-1">
            <textarea
              value={editDraft}
              onChange={(event) => setEditDraft(event.target.value)}
              rows={2}
              maxLength={2000}
              className={cn(DRAFT_CLASS, "resize-y")}
              autoFocus
            />
            <div className="mt-1.5 flex items-center gap-2">
              <button
                type="submit"
                disabled={busy || !editDraft.trim()}
                className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-3 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
              >
                <Check className="h-3 w-3" strokeWidth={3} />
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-slate-500 transition-colors hover:bg-slate-100"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <p className="mt-0.5 whitespace-pre-line break-words text-sm leading-5 text-slate-600">
            {comment.text}
          </p>
        )}

        {/* Reply composer */}
        {replyOpen ? (
          <form onSubmit={submitReply} className="mt-2 flex gap-2">
            <input
              type="text"
              value={replyDraft}
              onChange={(event) => setReplyDraft(event.target.value)}
              placeholder={`Reply to ${comment.author?.name ?? "this"}…`}
              maxLength={2000}
              autoFocus
              className={DRAFT_CLASS}
            />
            <button
              type="submit"
              disabled={busy || !replyDraft.trim()}
              className="inline-flex items-center gap-1 rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
            >
              Reply
            </button>
          </form>
        ) : null}

        {/* Replies (one level deep) */}
        {replies.length > 0 ? (
          <ul className="mt-2.5 space-y-3 border-l-2 border-slate-100 pl-3 sm:pl-4">
            {replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                replies={[]}
                user={user}
                canEditTask={canEditTask}
                busy={busy}
                onDone={onDone}
                onError={onError}
              />
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  );
}

/**
 * Task discussion — threaded comments with replies, inline editing of your
 * own comments, delete (author or editor+), avatars and relative times.
 * Mutations are performed through `onDone` so the parent refreshes the
 * task (and its comment list) after each change.
 */
export default function CommentsThread({ task, user }) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const taskId = task.id;
  const comments = task.comments || [];
  const canEditTask = canEditTasks(task.myRole);

  const roots = comments.filter((c) => !c.parentId);
  const repliesOf = (comment) => comments.filter((c) => c.parentId === comment.id);

  useEffect(() => {
    setError(null);
    setDraft("");
  }, [taskId]);

  /** Run a mutation, refresh the parent task, surface failure. */
  const onDone = async (fn) => {
    setError(null);
    setBusy(true);
    try {
      await fn();
      await task.refresh?.();
      return { ok: true };
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.errors?.[0]?.msg ||
          "Something went wrong. Please try again."
      );
      return { ok: false };
    } finally {
      setBusy(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    await onDone(() => addComment(taskId, text));
    setDraft("");
  };

  return (
    <section>
      <h3 className="mb-2 inline-flex items-center gap-1.5 text-sm font-bold text-slate-800">
        <MessageSquare className="h-4 w-4 text-brand-500" />
        Discussion
        {comments.length > 0 ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-slate-500">
            {comments.length}
          </span>
        ) : null}
      </h3>

      {error ? (
        <p className="mb-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
          {error}
        </p>
      ) : null}

      {roots.length > 0 ? (
        <ul className="mb-3 space-y-4">
          {roots.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={{ ...comment, taskId }}
              replies={repliesOf(comment).map((r) => ({ ...r, taskId }))}
              user={user}
              canEditTask={canEditTask}
              busy={busy}
              onDone={onDone}
            />
          ))}
        </ul>
      ) : (
        <p className="mb-3 text-xs text-slate-400">
          No comments yet — start the discussion below.
        </p>
      )}

      {/* New comment */}
      <form onSubmit={submit} className="flex items-start gap-2.5">
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-[10px] font-bold text-white">
          {user?.name ? initialsOf(user.name) : <UserRound className="h-3.5 w-3.5" />}
        </span>
        <div className="min-w-0 flex-1">
          <input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Write a comment…"
            maxLength={2000}
            className={DRAFT_CLASS}
          />
          {draft.trim() ? (
            <div className="mt-1.5 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setDraft("")}
                className="inline-flex items-center gap-0.5 rounded-full px-2 py-1 text-[11px] font-semibold text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-3 w-3" />
                Discard
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-full bg-brand-600 px-3.5 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
              >
                Comment
              </button>
            </div>
          ) : null}
        </div>
      </form>
    </section>
  );
}
