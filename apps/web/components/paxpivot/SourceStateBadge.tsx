import { Disclosure } from "@/components/ui/Disclosure";
import { StatusPill } from "@/components/ui/Pill";
import {
  SOURCE_STATE_LEXICON,
  isSourceStateCode,
  type SourceStateLexeme,
} from "@/lib/presentation/source-state";
import type { SourceEvidenceView } from "@/lib/presentation/types";

const UNRECOGNISED: SourceStateLexeme = {
  label: "Unknown state",
  tone: "unknown",
  srText: "state not recognised; treated as unknown",
};

export function lexemeFor(state: string): SourceStateLexeme {
  return isSourceStateCode(state) ? SOURCE_STATE_LEXICON[state] : UNRECOGNISED;
}

export const NOT_CHECKED_TEXT = "Not checked yet";

/**
 * Compact state pill. The state is application truth; the badge never derives or upgrades it.
 * With no evidence at all (a source PaxPivot has never read) it says so instead of picking a state.
 */
export function SourceStateBadge({
  evidence,
}: {
  evidence: SourceEvidenceView | undefined;
}) {
  if (!evidence) {
    return (
      <StatusPill tone="unknown" srText="PaxPivot has not read this source yet">
        {NOT_CHECKED_TEXT}
      </StatusPill>
    );
  }
  const lexeme = lexemeFor(evidence.state);
  return (
    <StatusPill tone={lexeme.tone} srText={lexeme.srText}>
      {lexeme.label}
      {evidence.ageText ? ` ${evidence.ageText}` : null}
    </StatusPill>
  );
}

/** The full deterministic explanation (TASK-002), behind a "Why?" instead of on the surface. */
export function SourceStateDisclosure({
  evidence,
}: {
  evidence: SourceEvidenceView | undefined;
}) {
  if (!evidence?.explanation) return null;
  return (
    <Disclosure summary="Why?">
      <p>{evidence.explanation}</p>
    </Disclosure>
  );
}
