"use client";

import { Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { ASK_HREF, isActive } from "@/lib/presentation/navigation";

/** Ask PaxPivot is a contextual floating action, never a permanent navigation destination. */
export function AskPaxPivotAction() {
  const pathname = usePathname();
  const hidden = isActive(pathname, ASK_HREF);
  // While the action is not shown, mark the body so the page stops reserving room for it
  // (components.css treats this like the mark a sticky action bar sets).
  useEffect(() => {
    if (!hidden) return;
    document.body.dataset.noFab = "true";
    return () => {
      delete document.body.dataset.noFab;
    };
  }, [hidden]);
  if (hidden) return null;
  return (
    <Link href={ASK_HREF} className="pp-fab" aria-label="Ask PaxPivot">
      <Sparkles className="pp-i" aria-hidden="true" />
      Ask
    </Link>
  );
}
