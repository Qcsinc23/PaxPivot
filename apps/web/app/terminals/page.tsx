import { TerminalNetworkScreen } from "@/components/screens/terminals/TerminalNetworkScreen";
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
 * * `not_configured` — the API is not wired up for this deployment, so the screen says that
 *   rather than implying the network is empty;
 * * `unauthorized` / `unavailable` — a failure on our side.
 */
export default async function TerminalsPage() {
  const result = await readApi<TerminalNetworkRead>("/api/v1/terminals");
  if (!result.ok) {
    const model: TerminalNetworkScreenModel = {
      status: result.reason === "not_configured" ? "empty" : "error",
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
