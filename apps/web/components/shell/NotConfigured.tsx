import { AppHeader } from "@/components/ui/AppHeader";
import { ErrorState } from "@/components/ui/States";

export const NOT_CONFIGURED_TITLE = "PaxPivot data is not available right now.";
export const NOT_CONFIGURED_BODY =
  "This is a configuration problem, not evidence that no terminals or sources exist.";

/**
 * A missing API URL/token is an operational failure of this deployment. It is rendered as an
 * error, never as an empty registry: "no terminals" is a fact only a successful API response
 * can state. No configuration detail or secret is shown.
 */
export function NotConfigured({ title }: { title: string }) {
  return (
    <>
      <AppHeader title={title} />
      <ErrorState title={NOT_CONFIGURED_TITLE} body={NOT_CONFIGURED_BODY} />
    </>
  );
}
