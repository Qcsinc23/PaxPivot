"use client";

import { ErrorState } from "@/components/ui/States";

/** A failure on our side. Never worded as an absence of flights; never shows the error text. */
export default function RouteError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <ErrorState
      title="Something went wrong on our side"
      body="This is a failure in PaxPivot, not a statement about what is flying. Nothing has been ruled out."
      action={
        <button
          type="button"
          className="pp-btn"
          data-variant="secondary"
          onClick={reset}
        >
          Try again
        </button>
      }
    />
  );
}
