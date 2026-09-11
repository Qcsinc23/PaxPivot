import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

type CardProps = ComponentPropsWithoutRef<"section"> & {
  tone?: "surface" | "muted" | "flat" | "handoff";
  as?: "section" | "article" | "div" | "li";
};

export function Card({
  tone = "surface",
  as: Tag = "section",
  className,
  ...rest
}: CardProps) {
  return (
    <Tag
      {...rest}
      data-tone={tone === "surface" ? undefined : tone}
      className={["pp-card", className].filter(Boolean).join(" ")}
    />
  );
}

export function CardHeader({ children }: { children: ReactNode }) {
  return <div className="pp-card__hd">{children}</div>;
}

/** Pushes itself to the end of a card header row. */
export function CardEnd({ children }: { children: ReactNode }) {
  return <span className="pp-card__end">{children}</span>;
}

export function CardActions({ children }: { children: ReactNode }) {
  return <div className="pp-card__actions">{children}</div>;
}

/** A list of divided rows; each `Row` is a 44px-tall line with body and end slots. */
export function Rows({
  children,
  className,
  ...rest
}: ComponentPropsWithoutRef<"ul">) {
  return (
    <ul {...rest} className={["pp-rows", className].filter(Boolean).join(" ")}>
      {children}
    </ul>
  );
}

type RowProps = {
  icon?: ReactNode;
  iconTone?: "verified" | "caution";
  title: ReactNode;
  detail?: ReactNode;
  end?: ReactNode;
  href?: string;
};

export function Row({ icon, iconTone, title, detail, end, href }: RowProps) {
  const body = (
    <>
      {icon ? (
        <span className="pp-row__icon" data-tone={iconTone}>
          {icon}
        </span>
      ) : null}
      <span className="pp-row__body">
        <span className="pp-row__title">{title}</span>
        {detail ? <span className="pp-row__sub">{detail}</span> : null}
      </span>
      {end ? <span className="pp-row__end">{end}</span> : null}
    </>
  );
  return (
    <li>
      {href ? (
        <Link className="pp-row" href={href}>
          {body}
        </Link>
      ) : (
        <div className="pp-row">{body}</div>
      )}
    </li>
  );
}
