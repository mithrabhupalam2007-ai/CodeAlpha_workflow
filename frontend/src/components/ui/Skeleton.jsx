import { cn } from "../../utils/cn.js";

/** Shimmer placeholder block — basis for all loading skeletons. */
export default function Skeleton({ className, ...props }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-lg bg-slate-200/70", className)}
      {...props}
    />
  );
}
