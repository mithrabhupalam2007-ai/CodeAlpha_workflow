import { useState } from "react";
import { ShieldCheck, Trash2, UserRound } from "lucide-react";

import Card from "../ui/Card.jsx";
import Button from "../ui/Button.jsx";
import Alert from "../ui/Alert.jsx";
import ConfirmDialog from "../ui/ConfirmDialog.jsx";
import { removeMember, updateMemberRole } from "../../api/projects.js";
import {
  ASSIGNABLE_ROLES,
  ROLE_BADGES,
  ROLE_LABELS,
  canActOnMember,
  canManageMembers,
  canManageSettings,
} from "../../utils/permissions.js";
import { initialsOf } from "../../utils/dates.js";
import { cn } from "../../utils/cn.js";

/**
 * Project members: list with avatars, role badges, owner-only role select,
 * and permission-aware remove buttons.
 */
export default function MembersCard({ project, currentUserId, onChanged }) {
  const myRole = project.myRole;
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [removing, setRemoving] = useState(false);

  const isOwner = canManageSettings(myRole);
  const mayManage = canManageMembers(myRole);

  const handleRoleChange = async (member, role) => {
    setError(null);
    setBusyId(member.id);
    try {
      await updateMemberRole(project.id, member.id, role);
      onChanged?.();
    } catch (err) {
      setError(err.response?.data?.message || "Couldn’t update the role.");
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async () => {
    if (!confirmTarget) return;
    setRemoving(true);
    setError(null);
    try {
      await removeMember(project.id, confirmTarget.id);
      setConfirmTarget(null);
      onChanged?.();
    } catch (err) {
      setError(err.response?.data?.message || "Couldn’t remove the member.");
      setConfirmTarget(null);
    } finally {
      setRemoving(false);
    }
  };

  return (
    <Card
      title="Members"
      subtitle={`${project.members.length} ${
        project.members.length === 1 ? "person" : "people"
      } have access`}
      action={
        mayManage ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-600">
            <ShieldCheck className="h-3.5 w-3.5" />
            {isOwner ? "Full control" : "Can invite"}
          </span>
        ) : null
      }
    >
      {error ? (
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
      ) : null}

      <ul className="divide-y divide-slate-100">
        {project.members.map((member) => {
          const isYou = member.id === currentUserId;
          const removable =
            mayManage &&
            canActOnMember(myRole, member.role) &&
            member.id !== currentUserId;
          const editable = isOwner && member.role !== "owner";

          return (
            <li
              key={member.id}
              className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-xs font-bold text-white">
                {initialsOf(member.name || member.email)}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {member.name || "Unnamed"}
                  {isYou ? (
                    <span className="ml-1.5 text-xs font-medium text-slate-400">
                      (you)
                    </span>
                  ) : null}
                </p>
                <p className="truncate text-xs text-slate-400">{member.email}</p>
              </div>

              {/* Role: badge for everyone, select for the owner */}
              {editable ? (
                <select
                  value={member.role}
                  disabled={busyId === member.id}
                  onChange={(event) => handleRoleChange(member, event.target.value)}
                  aria-label={`Role for ${member.name || member.email}`}
                  className="cursor-pointer rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-brand-300 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60"
                >
                  {ASSIGNABLE_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
              ) : (
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                    ROLE_BADGES[member.role] ?? ROLE_BADGES.viewer
                  )}
                >
                  {ROLE_LABELS[member.role] ?? member.role}
                </span>
              )}

              {removable ? (
                <button
                  type="button"
                  onClick={() => setConfirmTarget(member)}
                  aria-label={`Remove ${member.name || member.email}`}
                  title="Remove from project"
                  className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : (
                <span className="w-7 shrink-0" aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ul>

      {project.members.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-slate-400">
          <UserRound className="h-4 w-4" />
          No members yet.
        </p>
      ) : null}

      <ConfirmDialog
        open={Boolean(confirmTarget)}
        onClose={() => setConfirmTarget(null)}
        onConfirm={handleRemove}
        loading={removing}
        title="Remove member"
        message={`They will immediately lose access to “${project.name}”. You can invite them again later.`}
        confirmLabel="Remove"
      />
    </Card>
  );
}
