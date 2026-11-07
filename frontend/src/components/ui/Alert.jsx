import { AlertCircle, CheckCircle2, Info } from "lucide-react";

import { cn } from "../../utils/cn.js";

const VARIANTS = {
  error: {
    wrap: "border-rose-200 bg-rose-50 text-rose-700",
    icon: AlertCircle,
  },
  success: {
    wrap: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: CheckCircle2,
  },
  info: {
    wrap: "border-accent-200 bg-accent-50 text-accent-700",
    icon: Info,
  },
};

/** Form/page banner for errors, success, and info messages. */
export default function Alert({ variant = "info", title, children, className }) {
  const { wrap, icon: Icon } = VARIANTS[variant] ?? VARIANTS.info;

  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm",
        wrap,
        className
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn(title && "mt-0.5")}>{children}</div> : null}
      </div>
    </div>
  );
}
