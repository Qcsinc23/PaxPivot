"use client";

import { Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ASK_HREF, isActive } from "@/lib/presentation/navigation";

/** Ask PaxPivot is a contextual floating action, never a permanent navigation destination. */
export function AskPaxPivotAction() {
  const pathname = usePathname();
  if (isActive(pathname, ASK_HREF)) return null;
  return (
    <Link href={ASK_HREF} className="pp-fab" aria-label="Ask PaxPivot">
      <Sparkles className="pp-i" aria-hidden="true" />
      Ask
    </Link>
  );
}
