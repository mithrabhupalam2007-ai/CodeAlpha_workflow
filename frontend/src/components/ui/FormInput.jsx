import { useId, useState } from "react";
import { CircleAlert, Eye, EyeOff } from "lucide-react";

import { cn } from "../../utils/cn.js";

/**
 * Labelled text input with inline error message.
 * Password fields get a show/hide toggle automatically.
 */
export default function FormInput({
  label,
  id,
  type = "text",
  value,
  onChange,
  error,
  placeholder,
  autoComplete,
  required = false,
  disabled = false,
  className,
  ...props
}) {
  const [visible, setVisible] = useState(false);
  const autoId = useId();
  const inputId = id || autoId;
  const isPassword = type === "password";
  const inputType = isPassword ? (visible ? "text" : "password") : type;

  return (
    <div className={cn("w-full", className)}>
      {label ? (
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-sm font-semibold text-slate-700"
        >
          {label}
          {required ? <span className="ml-0.5 text-rose-500">*</span> : null}
        </label>
      ) : null}

      <div className="relative">
        <input
          id={inputId}
          type={inputType}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={cn(
            "w-full rounded-xl border bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-all",
            "focus:bg-white focus:outline-none focus:ring-4",
            isPassword ? "pr-11" : "pr-4",
            disabled && "cursor-not-allowed opacity-60",
            error
              ? "border-rose-300 focus:border-rose-400 focus:ring-rose-500/10"
              : "border-slate-200 focus:border-brand-300 focus:ring-brand-500/10"
          )}
          {...props}
        />

        {isPassword ? (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Hide password" : "Show password"}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition-colors hover:text-slate-600"
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        ) : null}
      </div>

      {error ? (
        <p
          id={`${inputId}-error`}
          className="mt-1.5 flex items-start gap-1 text-xs font-medium text-rose-600"
        >
          <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
