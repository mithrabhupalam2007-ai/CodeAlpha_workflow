import { useCallback, useEffect, useState } from "react";
import { MailPlus, RefreshCw, Send, X } from "lucide-react";

import Card from "../ui/Card.jsx";
import Button from "../ui/Button.jsx";
import Alert from "../ui/Alert.jsx";
import Skeleton from "../ui/Skeleton.jsx";
import EmptyState from "../ui/EmptyState.jsx";
import {
  createInvitation,
  getProjectInvitations,
  revokeInvitation,
} from "../../api/invitations.js";
import {
  ASSIGNABLE_ROLES,
  ROLE_BADGES,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  canManageMembers,
} from "../../utils/permissions.js";
import { relativeTime } from "../../utils/dates.js";
import { cn } from "../../utils/cn.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Invite-by-email panel + pending invitation list (owner/admin only).
 * `onChanged` fires when membership may have changed.
 */
export default function InvitationsCard({ project, onChanged }) {
  const mayManage = canManageMembers(project.myRole);

  const [invitations, setInvitations] = useState(null); // null = loading
  const [error, setError] = useState(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [formError, setFormError] = useState(null);
  const [sending, setSending] = useState(false);
  const [revokingId, setRevokingId] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await getProjectInvitations(project.id);
      setInvitations(data.invitations);
    } catch (err) {
      setInvitations([]);
      setError(err.response?.data?.message || "Couldn’t load invitations.");
    }
  }, [project.id]);

  useEffect(() => {
    if (mayManage) load();
  }, [mayManage, load]);

  if (!mayManage) return null;

  const handleInvite = async (event) => {
    event.preventDefault();
    setFormError(null);

    const value = email.trim().toLowerCase();
    if (!EMAIL_RE.test(value)) {
      setFormError("Please enter a valid email address.");
      return;
    }

    setSending(true);
    try {
      await createInvitation({ projectId: project.id, email: value, role });
      setEmail("");
      await load();
      onChanged?.(); // project itself doesn't change, but keeps parents in sync
    } catch (err) {
      setFormError(
        err.response?.data?.message ||
          "Couldn’t send the invitation. Please try again."
      );
    } finally {
      setSending(false);
    }
  };

  const handleRevoke = async (invitation) => {
    setRevokingId(invitation.id);
    setError(null);
    try {
      await revokeInvitation(invitation.id);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Couldn’t revoke the invitation.");
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <Card
      title="Invitations"
      subtitle="Invite teammates by email — they accept or decline from their Projects page"
      action={
        invitations && invitations.length > 0 ? (
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-600">
            {invitations.length} pending
          </span>
        ) : null
      }
    >
      {/* Invite form */}
      <form onSubmit={handleInvite} className="space-y-3">
        {formError ? <Alert variant="error">{formError}</Alert> : null}

        <div className="flex flex-col gap-2.5 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <MailPlus className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setFormError(null);
              }}
              placeholder="teammate@company.com"
              aria-label="Email address to invite"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 transition-all focus:border-brand-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/10"
            />
          </div>

          <select
            value={role}
            onChange={(event) => setRole(event.target.value)}
            aria-label="Role to grant"
            className="cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 transition-all focus:border-brand-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/10"
          >
            {ASSIGNABLE_ROLES.map((value) => (
              <option key={value} value={value}>
                {ROLE_LABELS[value]}
              </option>
            ))}
          </select>

          <Button type="submit" loading={sending} className="sm:w-auto">
            <Send className="h-4 w-4" />
            Invite
          </Button>
        </div>

        <p className="text-xs text-slate-400">
          {ROLE_DESCRIPTIONS[role]} Invitations expire after 7 days.
        </p>
      </form>

      {/* Pending list */}
      <div className="mt-5 border-t border-slate-100 pt-4">
        {invitations === null ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-rose-600">{error}</p>
            <button
              type="button"
              onClick={load}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-200"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        ) : invitations.length === 0 ? (
          <EmptyState
            icon={MailPlus}
            title="No pending invitations"
            description="Invitations you send will be listed here until they’re accepted or declined."
            className="py-6"
          />
        ) : (
          <ul className="space-y-2">
            {invitations.map((invitation) => (
              <li
                key={invitation.id}
                className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3.5 py-2.5"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-slate-400 shadow-soft">
                  <MailPlus className="h-4 w-4" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {invitation.email}
                  </p>
                  <p className="truncate text-xs text-slate-400">
                    Invited {relativeTime(invitation.createdAt)} ·{" "}
                    {invitation.invitedBy?.name || "a teammate"} · expires{" "}
                    {relativeTime(invitation.expiresAt)}
                  </p>
                </div>

                <span
                  className={cn(
                    "hidden shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold sm:block",
                    ROLE_BADGES[invitation.role] ?? ROLE_BADGES.viewer
                  )}
                >
                  {ROLE_LABELS[invitation.role]}
                </span>

                <button
                  type="button"
                  onClick={() => handleRevoke(invitation)}
                  disabled={revokingId === invitation.id}
                  aria-label={`Revoke invitation for ${invitation.email}`}
                  title="Revoke invitation"
                  className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
