import { CheckCircle2 } from "lucide-react";

import Logo from "../../components/ui/Logo.jsx";

const HIGHLIGHTS = [
  "Boards, lists, and tasks in one calm workspace",
  "Realtime collaboration with Socket.IO",
  "Secure accounts — JWT in HTTP-only cookies",
];

/**
 * Shared split-screen shell for all auth pages.
 * Navy brand panel on the left (lg+), centered form card on the right.
 */
export default function AuthLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-canvas">
      {/* Brand panel */}
      <aside className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-navy-900 via-navy-900 to-brand-950 p-12 text-white lg:flex">
        <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-accent-500/20 blur-3xl" />

        <Logo />

        <div className="relative max-w-md">
          <h1 className="text-3xl font-bold leading-tight tracking-tight">
            Plan, track, and ship
            <br />
            your team’s best work.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-400">
            WorkFlow brings projects, tasks, and realtime updates together —
            inspired by Trello and Asana, built with a premium SaaS feel.
          </p>

          <ul className="mt-8 space-y-3">
            {HIGHLIGHTS.map((item) => (
              <li
                key={item}
                className="flex items-center gap-2.5 text-sm text-slate-300"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-400" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-slate-500">
          © {new Date().getFullYear()} WorkFlow — built for modern teams.
        </p>
      </aside>

      {/* Form side */}
      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-md animate-fade-in">
          <div className="mb-8 flex justify-center lg:hidden">
            <Logo tone="light" />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
