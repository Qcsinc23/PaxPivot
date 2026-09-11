import Link from "next/link";
import { X } from "lucide-react";
import { RouteHeadlinePill } from "@/components/paxpivot/RouteCard";
import { SourceStateBadge } from "@/components/paxpivot/SourceStateBadge";
import { AppHeader } from "@/components/ui/AppHeader";
import { Button, IconButton } from "@/components/ui/Button";
import { Card, CardActions, CardHeader } from "@/components/ui/Card";
import { FactValue } from "@/components/ui/Facts";
import { StatusPill } from "@/components/ui/Pill";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { ASK_VERDICT_WORDING, askGroundingText } from "@/lib/presentation/ask";
import type { AskScreenModel } from "@/lib/presentation/screens/ask";

const COMPOSER_STYLE = {
  width: "100%",
  minHeight: "4.5rem",
  padding: "var(--space-2)",
  border: "1px solid var(--color-neutral-300)",
  borderRadius: "var(--radius-sm)",
  background: "var(--color-surface)",
  color: "var(--color-neutral-700)",
  resize: "vertical",
} as const;

type Props = { model: AskScreenModel };

/**
 * Ask PaxPivot: the question, the answer the application composed, its grounding, suggested
 * follow-ups and a composer that is present but disabled until the tool contract exists.
 *
 * The screen decides nothing. A verdict that is unknown says "Unknown" verbatim, the comparison
 * renders the emphasis it was given, and the grounding line is the application's own count.
 */
export function AskScreen({ model }: Props) {
  const header = (
    <AppHeader
      title="Ask PaxPivot"
      actions={
        <IconButton
          href="/"
          label="Close Ask PaxPivot"
          icon={<X className="pp-i-lg" aria-hidden="true" />}
        />
      }
    />
  );

  const composer = (
    <Card as="div" tone="flat" aria-label="Question composer">
      <label className="pp-label" htmlFor="ask-composer">
        Ask a question
      </label>
      <textarea
        id="ask-composer"
        style={COMPOSER_STYLE}
        placeholder={model.composerPlaceholder}
        disabled
      />
      <CardActions>
        <Button disabled>Ask</Button>
      </CardActions>
    </Card>
  );

  if (model.status === "empty") {
    return (
      <>
        {header}
        <EmptyState
          title="Ask PaxPivot is not connected yet"
          body="Questions are answered from PaxPivot's own records. That connection does not exist yet, so no answer is shown."
        />
        {composer}
      </>
    );
  }

  if (model.status === "loading") {
    return (
      <>
        {header}
        <LoadingState title="Ask PaxPivot" body="Looking up an answer." />
        {composer}
      </>
    );
  }

  if (model.status === "error") {
    return (
      <>
        {header}
        <ErrorState
          title="We could not answer that"
          body="This is a failure on our side, not a statement about what is available."
        />
        {composer}
      </>
    );
  }

  const { answer } = model;
  if (!answer) {
    // A ready model without an answer is a contract violation, not something to invent around.
    return (
      <>
        {header}
        <ErrorState
          title="We could not answer that"
          body="This is a failure on our side, not a statement about what is available."
        />
        {composer}
      </>
    );
  }

  const wording = ASK_VERDICT_WORDING[answer.verdict.kind];

  return (
    <>
      {header}

      <Card as="article" aria-label="Answer">
        <p className="pp-meta">You asked: {answer.question}</p>
        <CardHeader>
          <StatusPill tone={wording.tone}>{wording.label}</StatusPill>
        </CardHeader>
        <h2 className="pp-title">{answer.verdict.title}</h2>

        {answer.comparison ? (
          <div className="pp-table-wrap">
            <table className="pp-table">
              <caption>What the answer compared</caption>
              <thead>
                <tr>
                  <th scope="col">
                    <span className="sr-only">Field</span>
                  </th>
                  {answer.comparison.options.map((option) => (
                    <th key={option.id} scope="col">
                      {option.headline === "safest_overall" ? (
                        <StatusPill tone="best">Safest overall</StatusPill>
                      ) : (
                        <RouteHeadlinePill headline={option.headline} />
                      )}
                      <Link href={option.href} className="pp-table__title">
                        {option.title}
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {answer.comparison.rows.map((row) => (
                  <tr key={row.id}>
                    <th scope="row">{row.label}</th>
                    {row.cells.map((cell, index) => (
                      <td
                        key={`${row.id}-${index}`}
                        data-emphasis={
                          cell.emphasis === "none" ? undefined : cell.emphasis
                        }
                      >
                        <FactValue fact={cell.value} className="" />
                        {cell.evidence ? (
                          <>
                            {" "}
                            <SourceStateBadge evidence={cell.evidence} />
                          </>
                        ) : null}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <p className="pp-sub">{answer.explanation}</p>

        {answer.actions.length > 0 ? (
          <CardActions>
            {answer.actions.map((action) => (
              <Button
                key={action.label}
                href={action.href}
                variant={action.variant}
              >
                {action.label}
              </Button>
            ))}
          </CardActions>
        ) : null}

        <p className="pp-meta">{askGroundingText(answer.grounding)}</p>
      </Card>

      {answer.followUps.length > 0 ? (
        <ul aria-label="Suggested questions" className="pp-card__actions">
          {answer.followUps.map((followUp) => (
            <li key={followUp}>
              {/* Not wired: asking a follow-up needs the tool contract, so it is unavailable. */}
              <Button variant="secondary" size="sm" disabled>
                {followUp}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {composer}
    </>
  );
}
