import type { ReactNode } from "react";
import { AskPaxPivotAction } from "./AskPaxPivotAction";
import { BottomNavigation } from "./BottomNavigation";
import { DesktopRail } from "./DesktopRail";

/** Standing trust wording (pilot §11.1), kept to one line in the app variant. */
export const GUARANTEE_TEXT =
  "Space-A and provider availability are not guaranteed. Verify with the official source or provider.";

/**
 * Responsive application shell: bottom navigation below 60rem, left rail above it.
 * Both navigations are rendered; CSS shows exactly one, so assistive technology sees one.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="pp-shell">
      <a href="#main" className="pp-skip">
        Skip to content
      </a>
      <DesktopRail />
      <div className="pp-shell__body">
        <main id="main" className="pp-main" tabIndex={-1}>
          {children}
        </main>
        <footer className="pp-guarantee" role="contentinfo">
          {GUARANTEE_TEXT}
        </footer>
      </div>
      <BottomNavigation />
      <AskPaxPivotAction />
    </div>
  );
}
