"use client";

import { useEffect, type ReactNode } from "react";

type Props = { label: string; children: ReactNode };

/**
 * Thumb-reachable primary action row that stays above the bottom navigation. While mounted it
 * marks the body so the floating Ask action hides instead of covering the primary button.
 */
export function StickyActionBar({ label, children }: Props) {
  useEffect(() => {
    document.body.dataset.stickyBar = "true";
    return () => {
      delete document.body.dataset.stickyBar;
    };
  }, []);
  return (
    <div className="pp-sticky" role="group" aria-label={label}>
      {children}
    </div>
  );
}
