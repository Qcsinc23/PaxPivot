import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { IconButton } from "./Button";

type Props = {
  title: string;
  subtitle?: string;
  back?: { href: string; label?: string };
  actions?: ReactNode;
};

/** Compact top bar: back / title / actions. One `h1` per page lives here. */
export function AppHeader({ title, subtitle, back, actions }: Props) {
  return (
    <header className="pp-header">
      {back ? (
        <IconButton
          href={back.href}
          label={back.label ?? "Back"}
          icon={<ChevronLeft className="pp-i-lg" aria-hidden="true" />}
        />
      ) : null}
      <h1 className="pp-header__title">
        {title}
        {subtitle ? <small>{subtitle}</small> : null}
      </h1>
      {actions ? <div className="pp-header__actions">{actions}</div> : null}
    </header>
  );
}
