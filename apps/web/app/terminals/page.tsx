import { TerminalNetworkScreen } from "@/components/screens/terminals/TerminalNetworkScreen";
import { NotConfigured } from "@/components/shell/NotConfigured";
import { readApi } from "@/lib/api/client";
import type { TerminalNetworkRead } from "@/lib/api/contracts";
import { unknown } from "@/lib/presentation/fact";
import { toTerminalNetworkScreenModel } from "@/lib/presentation/adapters/terminals";
import type { TerminalNetworkScreenModel } from "@/lib/presentation/screens/terminals";

/**
 * Live Terminals route. Reads `GET /api/v1/terminals` on the server, adapts it, and renders the
 * model the application already decided. The token stays in this process: `readApi` refuses to run
 * in a browser, so no credential can reach a client bundle from here.
 *
 * Every outcome is its own state, and none of them is an absence claim:
 *
 * * `ok` — the registry, including an honest empty network when there are simply no terminals;
 * * `not_configured` — a configuration failure of this deployment, rendered as an error,
 *   never as an empty registry;
 * * `unauthorized` / `unavailable` — a failure on our side.
 */
export default async function TerminalsPage() {
  const result = await readApi<TerminalNetworkRead>("/api/v1/terminals");
  if (!result.ok) {
    if (result.reason === "not_configured") {
      return <NotConfigured title="Terminals" />;
    }
    const model: TerminalNetworkScreenModel = {
      status: "error",
      summary: { reachable: unknown(), excluded: unknown() },
      map: { title: "Terminal network", status: "empty", markers: [] },
      filter: "all",
      terminals: [],
    };
    return <TerminalNetworkScreen model={model} />;
  }
  return (
    <TerminalNetworkScreen
      model={toTerminalNetworkScreenModel(result.value, { now: new Date() })}
    />
  );
}
