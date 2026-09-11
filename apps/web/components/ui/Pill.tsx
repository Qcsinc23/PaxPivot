import type { ReactNode } from "react";
import type { StatusTone } from "@/lib/presentation/source-state";

export type PillTone = StatusTone | "best" | "space-a" | "ghost";

type Props = {
  tone: PillTone;
  children: ReactNode;
  icon?: ReactNode;
  /** Extra wording for assistive technology when the visible text is terse. */
  srText?: string;
};

/** Two or three words of state. The text carries the meaning; colour only reinforces it. */
export function StatusPill({ tone, children, icon, srText }: Props) {
  return (
    <span className="pp-pill" data-tone={tone}>
      {icon}
      {children}
      {srText ? <span className="sr-only">, {srText}</span> : null}
    </span>
  );
}
