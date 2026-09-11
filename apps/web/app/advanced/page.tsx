import { SourceHealthScreen } from "@/components/screens/advanced/SourceHealthScreen";
import { NotConfigured } from "@/components/shell/NotConfigured";
import { readApi } from "@/lib/api/client";
import type { SourceHealthRead } from "@/lib/api/contracts";
import { toSourceHealthScreenModel } from "@/lib/presentation/adapters/source-health";
import {
  emptySourceHealth,
  type SourceHealthScreenModel,
} from "@/lib/presentation/screens/advanced";

/**
 * Live Advanced route: the operations view of the source registry. Reads
 * `GET /api/v1/sources/health` on the server and adapts it — approval state, kill switches and the
 * last check of every registered source are the application's findings, and this route only
 * presents them. The token never leaves this process, and nothing here is an operator action:
 * enabling, approving or engaging a switch is not reachable from this screen.
 *
 * Every outcome is its own state, and none of them is an absence claim:
 *
 * * `ok` — the registry, including an honest empty state when no source is registered;
 * * `not_configured` — a configuration failure of this deployment, rendered as an error,
 *   never as an empty registry;
 * * `unauthorized` / `unavailable` — a failure on our side.
 */
// Live data is read per request; never prerendered at build time (where no API is configured).
export const dynamic = "force-dynamic";

export default async function AdvancedPage() {
  const result = await readApi<SourceHealthRead>("/api/v1/sources/health");
  if (!result.ok) {
    if (result.reason === "not_configured") {
      return <NotConfigured title="Source health" />;
    }
    const model: SourceHealthScreenModel = {
      ...emptySourceHealth,
      status: "error",
    };
    return <SourceHealthScreen model={model} />;
  }
  return (
    <SourceHealthScreen
      model={toSourceHealthScreenModel(result.value, { now: new Date() })}
    />
  );
}
