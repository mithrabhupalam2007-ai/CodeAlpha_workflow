import Spinner from "./Spinner.jsx";
import { cn } from "../../utils/cn.js";

const VARIANTS = {
  primary:
    "bg-gradient-to-r from-brand-600 to-accent-600 text-white shadow-card hover:-translate-y-0.5 hover:shadow-elevated",
  ghost:
    "border border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:text-brand-700",
  subtle: "bg-slate-100 text-slate-700 hover:bg-slate-200",
};

/**
 * App-wide button. Primary uses the WorkFlow indigo→blue gradient.
 * `loading` swaps in a spinner and disables the button.
 */
export default function Button({
  variant = "primary",
  loading = false,
  disabled = false,
  className,
  children,
  type = "button",
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/20",
        "disabled:pointer-events-none disabled:opacity-60",
        VARIANTS[variant] ?? VARIANTS.primary,
        className
      )}
      {...props}
    >
      {loading ? <Spinner className="h-4 w-4" /> : null}
      {children}
    </button>
  );
}