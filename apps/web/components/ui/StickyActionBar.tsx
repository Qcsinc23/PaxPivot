import type { ReactNode } from "react";

type Props = { label: string; children: ReactNode };

/** Thumb-reachable primary action row that stays above the bottom navigation. */
export function StickyActionBar({ label, children }: Props) {
  return (
    <div className="pp-sticky" role="group" aria-label={label}>
      {children}
    </div>
  );
}
