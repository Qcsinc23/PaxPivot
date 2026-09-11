import { Info } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  /** Short trigger text, e.g. "Why?" or "About these numbers". */
  summary: string;
  children: ReactNode;
};

/** Progressive disclosure on the native `<details>` element: the ⓘ that replaces a paragraph. */
export function Disclosure({ summary, children }: Props) {
  return (
    <details className="pp-disclosure">
      <summary>
        <Info className="pp-i" aria-hidden="true" />
        {summary}
      </summary>
      <div className="pp-disclosure__body">{children}</div>
    </details>
  );
}
