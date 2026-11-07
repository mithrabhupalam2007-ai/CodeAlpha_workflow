import { Loader2 } from "lucide-react";

import { cn } from "../../utils/cn.js";

/** Spinning loader icon. */
export default function Spinner({ className }) {
  return <Loader2 className={cn("h-4 w-4 animate-spin", className)} />;
}
