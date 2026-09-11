import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

export type ButtonVariant =
  | "primary"
  | "accent"
  | "secondary"
  | "ghost"
  | "plain";

type Common = {
  variant?: ButtonVariant;
  size?: "md" | "sm";
  block?: boolean;
  /** Decorative icon; the accessible name is the text (or `label` for IconButton). */
  icon?: ReactNode;
  className?: string;
};

type AsButton = Common &
  Omit<ComponentPropsWithoutRef<"button">, "className"> & { href?: undefined };
type AsLink = Common &
  Omit<ComponentPropsWithoutRef<"a">, "className" | "href"> & { href: string };

export type ButtonProps = AsButton | AsLink;

/** Espresso fill is the workhorse; `accent` is reserved for the one most consequential action. */
export function Button(props: ButtonProps) {
  const {
    variant = "primary",
    size = "md",
    block,
    icon,
    className,
    children,
    ...rest
  } = props;
  const attrs = {
    className: ["pp-btn", className].filter(Boolean).join(" "),
    "data-variant": variant,
    "data-size": size,
    "data-block": block ? "true" : undefined,
  };
  const content = (
    <>
      {icon}
      {children}
    </>
  );
  if (rest.href !== undefined) {
    const { href, ...anchor } = rest;
    return (
      <Link href={href} {...anchor} {...attrs}>
        {content}
      </Link>
    );
  }
  const { type = "button", ...button } = rest;
  return (
    <button type={type} {...button} {...attrs}>
      {content}
    </button>
  );
}

type IconButtonProps = Omit<ButtonProps, "children" | "icon" | "block"> & {
  /** Required accessible name; icon-only controls are never unlabeled. */
  label: string;
  icon: ReactNode;
};

export function IconButton({
  label,
  icon,
  className,
  variant = "plain",
  ...rest
}: IconButtonProps) {
  return (
    <Button
      {...(rest as ButtonProps)}
      variant={variant}
      aria-label={label}
      title={label}
      className={["pp-icon-btn", className].filter(Boolean).join(" ")}
    >
      {icon}
    </Button>
  );
}
