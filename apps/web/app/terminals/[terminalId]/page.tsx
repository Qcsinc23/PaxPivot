import { notFound } from "next/navigation";

import { TerminalDetailScreen } from "@/components/screens/terminals/TerminalDetailScreen";
import { NotConfigured } from "@/components/shell/NotConfigured";
import { readApi } from "@/lib/api/client";
import type { TerminalDetailRead } from "@/lib/api/contracts";
import { unknown } from "@/lib/presentation/fact";
import { toTerminalDetailScreenModel } from "@/lib/presentation/adapters/terminals";
import type { TerminalDetailScreenModel } from "@/lib/presentation/screens/terminals";

type Props = { params: Promise<{ terminalId: string }> };

/**
 * Live terminal detail route. Reads `GET /api/v1/terminals/{id}` on the server and renders the
 * model the application already decided; the token never leaves this process.
 *
 * `not_found` is the one outcome that becomes a 404 — the registry has no such terminal, which is a
 * statement about the URL rather than about the world. Every other failure renders the error state
 * ("a failure on our side"); `not_configured` is a configuration error, never an empty
 * registry. No outcome renders fixture data.
 */
// Live data is read per request; never prerendered at build time (where no API is configured).
export const dynamic = "force-dynamic";

export default async function TerminalDetailPage({ params }: Props) {
  const { terminalId } = await params;
  const result = await readApi<TerminalDetailRead>(
    `/api/v1/terminals/${encodeURIComponent(terminalId)}`,
  );
  if (!result.ok) {
    if (result.reason === "not_found") notFound();
    if (result.reason === "not_configured") {
      return <NotConfigured title="Terminal" />;
    }
    const model: TerminalDetailScreenModel = {
      status: "error",
      terminal: {
        id: terminalId,
        name: "",
        accessText: unknown(),
        entrance: { status: "unverified", label: unknown() },
        href: "/terminals",
      },
      map: { title: "Terminal map", status: "empty", markers: [] },
      stats: [],
      actions: {},
      opportunities: [],
      opportunitiesNote:
        "PaxPivot has not checked a source for this terminal yet.",
      travel: { rows: [], handoffs: [] },
      evidence: { rows: [], whyIncluded: "" },
      history: {
        observed: unknown(),
        successfulChecks: unknown(),
        periodText: "no period yet",
        sinceLastText: unknown(),
        medianSeats: unknown(),
        coverageNote: "",
      },
    };
    return <TerminalDetailScreen model={model} />;
  }
  return (
    <TerminalDetailScreen
      model={toTerminalDetailScreenModel(result.value, { now: new Date() })}
    />
  );
}
