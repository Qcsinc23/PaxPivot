"use client";

import { Row, Rows } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/Pill";
import { Sheet } from "@/components/ui/Sheet";
import type {
  WhyOrderOutcome,
  WhyOrderView,
} from "@/lib/presentation/screens/results";

/** The comparator's own words. Colour reinforces; the text carries the meaning. */
const OUTCOME_LABEL: Readonly<Record<WhyOrderOutcome, string>> = {
  decided: "Decided here",
  not_needed: "Not needed",
  not_used: "Not used",
};

type Props = { model: WhyOrderView; open: boolean; onClose: () => void };

/**
 * "Why this order": the comparator fields in the order the engine applied them, with the first
 * decisive field called out. The note is application wording — the screen adds no methodology.
 *
 * Mounted only while open, so nothing here affects the page while the sheet is closed.
 */
export function WhyOrderSheet({ model, open, onClose }: Props) {
  if (!open) return null;

  return (
    <Sheet open onClose={onClose} title="Why this order">
      <Rows aria-label="Comparison steps">
        {model.steps.map((step) => (
          <Row
            key={step.position}
            title={`${step.position}. ${step.label}`}
            detail={step.detail}
            end={
              <StatusPill tone={step.outcome === "decided" ? "best" : "ghost"}>
                {OUTCOME_LABEL[step.outcome]}
              </StatusPill>
            }
          />
        ))}
      </Rows>
      <p className="pp-meta">{model.note}</p>
    </Sheet>
  );
}
