import {
  Activity,
  Bell,
  Bookmark,
  MapPin,
  Search,
  User,
  type LucideIcon,
} from "lucide-react";

export type DestinationKey =
  | "plan"
  | "trips"
  | "alerts"
  | "terminals"
  | "profile"
  | "advanced";

export type Destination = {
  key: DestinationKey;
  href: string;
  label: string;
  icon: LucideIcon;
};

const D: Record<DestinationKey, Destination> = {
  plan: { key: "plan", href: "/", label: "Plan", icon: Search },
  trips: { key: "trips", href: "/trips", label: "Trips", icon: Bookmark },
  alerts: { key: "alerts", href: "/alerts", label: "Alerts", icon: Bell },
  terminals: {
    key: "terminals",
    href: "/terminals",
    label: "Terminals",
    icon: MapPin,
  },
  profile: { key: "profile", href: "/profile", label: "Profile", icon: User },
  advanced: {
    key: "advanced",
    href: "/advanced",
    label: "Advanced",
    icon: Activity,
  },
};

/** Mobile bottom navigation: five destinations. Ask PaxPivot is a floating action, not a tab. */
export const MOBILE_NAV: readonly Destination[] = [
  D.plan,
  D.trips,
  D.alerts,
  D.terminals,
  D.profile,
];

/** Desktop rail: four primary, then Profile and Advanced (source health lives under Advanced). */
export const RAIL_PRIMARY: readonly Destination[] = [
  D.plan,
  D.trips,
  D.terminals,
  D.alerts,
];
export const RAIL_SECONDARY: readonly Destination[] = [D.profile, D.advanced];

export const ASK_HREF = "/ask";

export function isActive(pathname: string, href: string): boolean {
  return href === "/"
    ? pathname === "/"
    : pathname === href || pathname.startsWith(`${href}/`);
}
