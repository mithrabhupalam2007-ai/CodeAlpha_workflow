/** Tiny class-name joiner (clsx-style, no dependency). */
export const cn = (...classes) => classes.filter(Boolean).join(" ");
