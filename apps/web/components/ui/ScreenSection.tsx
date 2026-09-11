import { useId, type ReactNode } from "react";

type Props = { title: string; children: ReactNode };

/**
 * A labelled `section` with an `h2` and the foundation's vertical rhythm. Screens compose their
 * lists under it so every list lands under a heading of its own (no skipped levels) and every
 * region has an accessible name.
 */
export function ScreenSection({ title, children }: Props) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="pp-section">
      <h2 id={id} className="pp-title">
        {title}
      </h2>
      {children}
    </section>
  );
}
