import { Link } from "react-router-dom";
import { ArrowLeft, Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="animate-fade-in text-center">
        <span className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 shadow-glow">
          <Compass className="h-8 w-8 text-white" />
        </span>

        <p className="bg-gradient-to-r from-brand-600 to-accent-500 bg-clip-text text-7xl font-extrabold tracking-tight text-transparent">
          404
        </p>

        <h1 className="mt-4 text-xl font-bold text-slate-900">
          Page not found
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
          The page you’re looking for doesn’t exist or has been moved.
        </p>

        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-accent-600 px-5 py-2.5 text-sm font-semibold text-white shadow-card transition-all hover:-translate-y-0.5 hover:shadow-elevated"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
