import { ArrowDownUp, CircleX, ClockAlert, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { AlertKind, AlertRowView } from "@/lib/presentation/types";

const ICON: Record<AlertKind, typeof ClockAlert> = {
  route_order: ArrowDownUp,
  source: ClockAlert,
  readiness: ListChecks,
  opportunity: CircleX,
};

/** One sentence, a timestamp, a single action. */
export function AlertRow({ alert }: { alert: AlertRowView }) {
  const Icon = ICON[alert.kind];
  return (
    <li className="pp-row">
      <span
        className="pp-row__icon"
        data-tone={alert.tone === "unknown" ? undefined : alert.tone}
      >
        <Icon className="pp-i-lg" aria-hidden="true" />
      </span>
      <span className="pp-row__body">
        <span className="pp-row__title">{alert.title}</span>
        <span className="pp-row__sub">{alert.detail}</span>
      </span>
      <span className="pp-row__end">
        <time className="pp-meta" dateTime={alert.when.iso}>
          {alert.when.text}
        </time>
        <Button href={alert.action.href} variant="ghost" size="sm">
          {alert.action.label}
        </Button>
      </span>
    </li>
  );
}

export function AlertList({
  alerts,
  label = "Alerts",
}: {
  alerts: readonly AlertRowView[];
  label?: string;
}) {
  return (
    <ul className="pp-rows" aria-label={label}>
      {alerts.map((alert) => (
        <AlertRow key={alert.id} alert={alert} />
      ))}
    </ul>
  );
}
