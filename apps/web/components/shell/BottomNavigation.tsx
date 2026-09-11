"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MOBILE_NAV, isActive } from "@/lib/presentation/navigation";

export function BottomNavigation() {
  const pathname = usePathname();
  return (
    <nav className="pp-bottom-nav" aria-label="Primary">
      {MOBILE_NAV.map(({ key, href, label, icon: Icon }) => (
        <Link
          key={key}
          href={href}
          aria-current={isActive(pathname, href) ? "page" : undefined}
        >
          <Icon className="pp-i-lg" aria-hidden="true" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
