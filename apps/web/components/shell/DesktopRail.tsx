"use client";

import { PlaneTakeoff } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  RAIL_PRIMARY,
  RAIL_SECONDARY,
  isActive,
  type Destination,
} from "@/lib/presentation/navigation";

function RailLink({
  destination,
  pathname,
}: {
  destination: Destination;
  pathname: string;
}) {
  const { href, label, icon: Icon } = destination;
  return (
    <Link
      href={href}
      aria-current={isActive(pathname, href) ? "page" : undefined}
    >
      <Icon className="pp-i" aria-hidden="true" />
      {label}
    </Link>
  );
}

export function DesktopRail() {
  const pathname = usePathname();
  return (
    <nav className="pp-rail" aria-label="Application">
      <Link href="/" className="pp-rail__brand">
        <PlaneTakeoff
          className="pp-i-lg"
          aria-hidden="true"
          style={{ color: "var(--color-accent)" }}
        />
        PaxPivot
      </Link>
      {RAIL_PRIMARY.map((destination) => (
        <RailLink
          key={destination.key}
          destination={destination}
          pathname={pathname}
        />
      ))}
      <div className="pp-rail__secondary">
        {RAIL_SECONDARY.map((destination) => (
          <RailLink
            key={destination.key}
            destination={destination}
            pathname={pathname}
          />
        ))}
      </div>
    </nav>
  );
}
