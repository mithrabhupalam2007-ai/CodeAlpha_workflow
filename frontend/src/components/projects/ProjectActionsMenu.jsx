import { useCallback, useRef, useState } from "react";
import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import { useClickOutside } from "../../hooks/useClickOutside.js";
import { canManageSettings } from "../../utils/permissions.js";
import { cn } from "../../utils/cn.js";

/**
 * ⋯ dropdown on a project card / detail header.
 * Items are gated by the viewer's project role (owner-only actions hidden).
 */
export default function ProjectActionsMenu({ project, myRole, onEdit, onArchive, onRestore, onDelete }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const close = useCallback(() => setOpen(false), []);
  useClickOutside(rootRef, close, open);

  if (!canManageSettings(myRole)) return null;

  const isArchived = project.status === "archived";
  const items = isArchived
    ? [
        { key: "restore", label: "Restore project", Icon: ArchiveRestore, onClick: onRestore },
        { key: "delete", label: "Delete project", Icon: Trash2, danger: true, onClick: onDelete },
      ]
    : [
        { key: "edit", label: "Edit project", Icon: Pencil, onClick: onEdit },
        { key: "archive", label: "Archive project", Icon: Archive, onClick: onArchive },
        { key: "delete", label: "Delete project", Icon: Trash2, danger: true, onClick: onDelete },
      ];

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        aria-label="Project options"
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-card"
        >
          {items.map(({ key, label, Icon, danger, onClick }) => (
            <button
              key={key}
              type="button"
              role="menuitem"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                close();
                onClick?.(event);
              }}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                danger
                  ? "text-rose-600 hover:bg-rose-50"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
