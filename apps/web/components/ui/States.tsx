import { Compass, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Skeleton } from "./Skeleton";

type StateProps = {
  title: string;
  body?: string;
  action?: ReactNode;
  icon?: ReactNode;
};

/** Nothing to show yet: explain the needed input and give the next action (pilot §11.3). */
export function EmptyState({ title, body, action, icon }: StateProps) {
  return (
    <div className="pp-state">
      <span className="pp-state__icon">
        {icon ?? <Compass size={32} aria-hidden="true" />}
      </span>
      <h2 className="pp-serif" style={{ fontSize: "1.5rem" }}>
        {title}
      </h2>
      {body ? <p className="pp-sub">{body}</p> : null}
      {action}
    </div>
  );
}

/** A failure on our side. Never worded as an absence of flights. */
export function ErrorState({ title, body, action, icon }: StateProps) {
  return (
    <div className="pp-state" data-tone="caution" role="alert">
      <span className="pp-state__icon">
        {icon ?? <TriangleAlert size={32} aria-hidden="true" />}
      </span>
      <h2 className="pp-title">{title}</h2>
      {body ? <p className="pp-sub">{body}</p> : null}
      {action}
    </div>
  );
}

type LoadingProps = { title: string; body?: string; lines?: number };

/** Announces what is pending and keeps identity visible; skeletons are decorative. */
export function LoadingState({ title, body, lines = 3 }: LoadingProps) {
  return (
    <div className="pp-card" role="status" aria-live="polite" aria-busy="true">
      <span className="pp-card__title">{title}</span>
      {body ? <span className="pp-meta">{body}</span> : null}
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} width={`${100 - index * 15}%`} />
      ))}
    </div>
  );
}
