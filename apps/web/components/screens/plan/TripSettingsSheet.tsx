"use client";

import { Button } from "@/components/ui/Button";
import { Card, Row, Rows } from "@/components/ui/Card";
import { FactValue } from "@/components/ui/Facts";
import { StatusPill } from "@/components/ui/Pill";
import { Progress } from "@/components/ui/Progress";
import { Sheet } from "@/components/ui/Sheet";
import { StickyActionBar } from "@/components/ui/StickyActionBar";
import type {
  AccessLimitView,
  TripSettingsModel,
} from "@/lib/presentation/screens/plan";

type Props = {
  model: TripSettingsModel;
  open: boolean;
  onClose: () => void;
};

/** A limit's display value and the bar position the application established, never derived here. */
function LimitRow({ label, limit }: { label: string; limit: AccessLimitView }) {
  return (
    <div>
      <div className="pp-card__hd">
        <span className="pp-fact__l">{label}</span>
        <span className="pp-card__end">
          <FactValue fact={limit.value} />
        </span>
      </div>
      {limit.progress === undefined ? null : (
        <Progress label={label} value={limit.progress} />
      )}
    </div>
  );
}

/**
 * Trip settings, one tap down from Plan. Access limits, positioning choices and the party are
 * shown as the application supplied them; this task wires no persistence, so the actions only
 * dismiss the sheet.
 *
 * Mounted only while open: `StickyActionBar` marks the document body so the floating Ask
 * action steps aside, and that mark must not outlive the sheet.
 */
export function TripSettingsSheet({ model, open, onClose }: Props) {
  if (!open) return null;

  return (
    <Sheet open onClose={onClose} title="Trip settings">
      <Card as="div" tone="flat">
        <span className="pp-label">Access limits</span>
        <LimitRow label="Max drive" limit={model.driveLimit} />
        <LimitRow label="Max transit" limit={model.transitLimit} />
      </Card>

      <Card as="div" tone="flat">
        <span className="pp-label">Positioning</span>
        <Rows aria-label="Positioning choices">
          {model.toggles.map((toggle) => (
            <Row
              key={toggle.id}
              title={toggle.title}
              detail={toggle.detail}
              end={
                <StatusPill tone={toggle.enabled ? "verified" : "ghost"}>
                  {toggle.enabled ? "On" : "Off"}
                </StatusPill>
              }
            />
          ))}
        </Rows>
      </Card>

      <Card as="div" tone="flat">
        <span className="pp-label">Party</span>
        <Rows aria-label="Travel party">
          {model.party.map((member) => (
            <Row
              key={member.id}
              title={member.name}
              detail={member.roleText}
              href={member.href}
            />
          ))}
        </Rows>
      </Card>

      <p className="pp-inline-actions">
        <Button href={model.whyHref} variant="ghost" size="sm">
          Why the sponsor rule applies
        </Button>
      </p>

      <StickyActionBar label="Trip settings actions">
        <Button variant="secondary" onClick={onClose}>
          Reset
        </Button>
        <Button onClick={onClose}>Apply</Button>
      </StickyActionBar>
    </Sheet>
  );
}
