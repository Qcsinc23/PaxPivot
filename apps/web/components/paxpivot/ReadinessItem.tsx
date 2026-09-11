import { Circle, CircleCheck, TriangleAlert } from "lucide-react";
import { Disclosure } from "@/components/ui/Disclosure";
import { StatusPill } from "@/components/ui/Pill";
import type { ReadinessItemView } from "@/lib/presentation/types";

const STATUS_TEXT: Record<ReadinessItemView["status"], string> = {
  done: "Done",
  due: "Due",
  unresolved: "Unresolved",
  pending: "Not started",
};

export function ReadinessItem({ item }: { item: ReadinessItemView }) {
  const Icon =
    item.status === "done"
      ? CircleCheck
      : item.status === "unresolved"
        ? TriangleAlert
        : Circle;
  const iconTone =
    item.status === "done"
      ? "verified"
      : item.status === "pending"
        ? undefined
        : "caution";
  return (
    <li>
      <div className="pp-row">
        <span className="pp-row__icon" data-tone={iconTone}>
          <Icon className="pp-i-lg" aria-hidden="true" />
        </span>
        <span className="pp-row__body">
          <span className="pp-row__title">{item.title}</span>
          {item.detail ? (
            <span className="pp-row__sub">{item.detail}</span>
          ) : null}
        </span>
        <span className="pp-row__end">
          {item.status === "due" && item.dueText ? (
            <StatusPill tone="caution">{item.dueText}</StatusPill>
          ) : (
            <span className="pp-meta">{STATUS_TEXT[item.status]}</span>
          )}
        </span>
      </div>
      {item.explanation ? (
        <Disclosure summary="Why?">
          <p>{item.explanation}</p>
        </Disclosure>
      ) : null}
    </li>
  );
}

export function ReadinessList({
  items,
  label = "Readiness",
}: {
  items: readonly ReadinessItemView[];
  label?: string;
}) {
  return (
    <ul className="pp-rows" aria-label={label}>
      {items.map((item) => (
        <ReadinessItem key={item.id} item={item} />
      ))}
    </ul>
  );
}
