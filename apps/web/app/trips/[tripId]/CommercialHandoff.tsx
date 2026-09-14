import { useId } from "react";
import { HandoffLabel } from "@/components/paxpivot/Handoff";
import { Button } from "@/components/ui/Button";
import { Card, CardActions, CardHeader } from "@/components/ui/Card";
import { FactStrip } from "@/components/ui/Facts";
import { ScreenSection } from "@/components/ui/ScreenSection";
import type { CommercialHandoffViewModel } from "@/lib/presentation/adapters/commercial-handoff";

/** COM-003: what this handoff cannot promise, stated plainly before either link is opened. */
const CAVEATS: readonly string[] = [
  "Google Flights may omit valid options, or show them in a different order than expected.",
  "This link's prefilled search may not match what you asked for — check it once it opens.",
  "Any price Google shows is Google's, and may differ from what you would actually pay.",
  "If your itinerary needs a self-transfer between flights, checking bag transfer and connection time is on you.",
];

/**
 * TASK-053: the commercial fallback below "Terminals to check" — a Google Flights handoff for
 * this trip's destination, window and party size. Never a fare, a booking, or a claim about
 * Space-A; PaxPivot fetches nothing from Google here or anywhere else (PRV-003).
 */
export function CommercialHandoff({
  model,
}: {
  model: CommercialHandoffViewModel;
}) {
  const titleId = useId();
  return (
    <ScreenSection title="Commercial flight alternative">
      <Card as="article" tone="handoff" aria-labelledby={titleId}>
        <CardHeader>
          <h3 id={titleId} className="pp-card__title">
            Search commercial flights on Google Flights
          </h3>
        </CardHeader>
        <p className="pp-sub">
          Commercial flights are a paid alternative. PaxPivot shows no fares
          here or anywhere else, and nothing on this page says what Space-A will
          or will not fly — this only opens a search you run yourself, in a new
          tab.
        </p>
        <HandoffLabel />
        <FactStrip facts={model.facts} />
        <p className="pp-sub">
          The suggested origin airports are a curated suggestion PaxPivot has
          not verified — check them yourself before you rely on this search.
        </p>
        <ul aria-label="Before you rely on this search" className="pp-stack">
          {CAVEATS.map((caveat) => (
            <li key={caveat} className="pp-sub">
              {caveat}
            </li>
          ))}
        </ul>
        <CardActions>
          <Button
            href={model.prefilledHref}
            target="_blank"
            rel="noopener noreferrer"
            size="sm"
          >
            Open Google Flights search
          </Button>
          <Button
            href={model.plainHref}
            variant="ghost"
            target="_blank"
            rel="noopener noreferrer"
            size="sm"
          >
            Prefill wrong? Open a plain search
          </Button>
        </CardActions>
      </Card>
    </ScreenSection>
  );
}
