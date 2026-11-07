/**
 * Date helpers for the dashboard (all local timezone).
 */

export const relativeTime = (value) => {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(Math.abs(diffMs) / 60000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const past = diffMs > 0;

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return rtf.format(past ? -diffMin : diffMin, "minute");

  const hours = Math.floor(diffMin / 60);
  if (hours < 24) return rtf.format(past ? -hours : hours, "hour");

  const days = Math.floor(hours / 24);
  if (days < 30) return rtf.format(past ? -days : days, "day");

  const months = Math.floor(days / 30);
  return rtf.format(past ? -months : months, "month");
};

/** Whole days between today (local midnight) and the date. */
export const daysUntil = (value) => {
  const target = new Date(value);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
};

export const formatDate = (value, options = { month: "short", day: "numeric" }) =>
  new Date(value).toLocaleDateString(undefined, options);

/** Due-date chip: text + tone ("rose" overdue/today, "amber" soon, "slate" later). */
export const dueLabel = (value) => {
  if (!value) return null;
  const days = daysUntil(value);
  if (days < 0) return { text: `${Math.abs(days)}d overdue`, tone: "rose" };
  if (days === 0) return { text: "Due today", tone: "rose" };
  if (days === 1) return { text: "Due tomorrow", tone: "amber" };
  if (days <= 7) return { text: `Due in ${days}d`, tone: "amber" };
  return { text: `Due ${formatDate(value)}`, tone: "slate" };
};

export const isSameLocalDay = (value) => {
  const d = new Date(value);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
};

export const initialsOf = (name) =>
  (name || "User")
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
