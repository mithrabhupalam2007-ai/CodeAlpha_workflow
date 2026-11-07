import { useCallback, useEffect, useState } from "react";
import { Check, FolderKanban, Mail, RefreshCw, X } from "lucide-react";

import Alert from "../ui/Alert.jsx";
import Skeleton from "../ui/Skeleton.jsx";
import {
  acceptInvitation,
  declineInvitation,
  getMyInvitations,
} from "../../api/invitations.js";
import { projectColor } from "../../utils/projectColors.js";
import { ROLE_BADGES, ROLE_LABELS } from "../../utils/permissions.js";
import { relativeTime } from "../../utils/dates.js";
import { cn } from "../../utils/cn.js";

/**
 * Banner at the top of the Projects page: invitations addressed to the
 * signed-in user's email, with Accept / Decline actions.
 * Renders nothing when there are none.
 */
export default function InvitationsBanner({ onChanged }) {
  const [invitations, setInvitations] = useState(null); // null = loading
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await getMyInvitations();
      setInvitations(data.invitations);
    } catch (err) {
      setInvitations([]);
      setError(err.response?.data?.message || "Couldn’t load invitations.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const respond = async (invitation, action) => {
    setBusyId(invitation.id);
    setError(null);
    try {
      if (action === "accept") await acceptInvitation(invitation.id);
      else await declineInvitation(invitation.id);
      setInvitations((prev) =>
        (prev || []).filter((entry) => entry.id !== invitation.id)
      );
      if (action === "accept") onChanged?.();
    } catch (err) {
      setError(err.response?.data?.message || "Couldn’t respond to the invitation.");
      await load(); // refresh — the invitation may have expired/changed
    } finally {
      setBusyId(null);
    }
  };

  if (invitations === null && !error) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full rounded-panel" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="error">
        <div className="flex flex-wrap items-center justify-between gap-2">
        <span>{error}</span>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white/70 px-2.5 py-1 text-xs font-semibold text-rose-700 transition-colors hover:bg-white"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </button>
        </div>
      </Alert>
    );
  }

  if (!invitations || invitations.length === 0) return null;

  return (
    <div className="rounded-panel border border-brand-200/70 bg-gradient-to-r from-brand-50/80 to-accent-50/60 p-5 shadow-soft">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-brand-600 shadow-soft">
          <Mail className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            Project invitations
          </h3>
          <p className="text-xs text-slate-500">
            {invitations.length} waiting for your response
          </p>
        </div>
      </div>

      <ul className="space-y-2.5">
        {invitations.map((invitation) => {
          const color = projectColor(invitation.project?.color);
          const busy = busyId === invitation.id;

          return (
            <li
              key={invitation.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-white/70 bg-white/90 px-4 py-3 shadow-soft"
            >
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white",
                  color.icon
                )}
              >
                <FolderKanban className="h-4 w-4" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {invitation.project?.name || "Project"}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {invitation.invitedBy?.name || "Someone"} invited you ·{" "}
                  {relativeTime(invitation.createdAt)} · as{" "}
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                      ROLE_BADGES[invitation.role] ?? ROLE_BADGES.viewer
                    )}
                  >
                    {ROLE_LABELS[invitation.role]}
                  </span>
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => respond(invitation, "decline")}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-800 disabled:opacity-60"
                >
                  <X className="h-3.5 w-3.5" />
                  Decline
                </button>
                <button
                  type="button"
                  onClick={() => respond(invitation, "accept")}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-600 to-accent-600 px-3.5 py-2 text-xs font-semibold text-white shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-card disabled:opacity-60"
                >
                  <Check className="h-3.5 w-3.5" />
                  {busy ? "Working…" : "Accept"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
