/**
 * Alerts feed view model (TASK-013).
 *
 * The feed arrives already filtered and ordered by the application. The screen reflects the
 * filter it was given and never selects, sorts or reinterprets a notification.
 */
import { fixtureAlerts as foundationAlertRows } from "@/lib/presentation/fixtures";
import type { AlertKind, AlertRowView } from "@/lib/presentation/types";

export type AlertFilter = "all" | AlertKind;

export type AlertsScreenModel = {
  status: "empty" | "ready" | "loading" | "error";
  /** The filter the application has already applied to `alerts`. */
  filter: AlertFilter;
  alerts: readonly AlertRowView[];
  /** Why a notification email is deliberately non-specific. */
  emailNote: { title: string; body: string };
  settingsHref: string;
};

/** The live route's model until a notifications API contract exists. Carries no product data. */
export const emptyAlerts: AlertsScreenModel = {
  status: "empty",
  filter: "all",
  alerts: [],
  emailNote: {
    title: "Email keeps it vague on purpose",
    body: "Notification email never carries movement detail; open PaxPivot to see the current state.",
  },
  settingsHref: "/profile",
};

/** Synthetic fixture for tests and the development showcase. Never rendered by a live route. */
export const fixtureAlerts: AlertsScreenModel = {
  status: "ready",
  filter: "all",
  alerts: foundationAlertRows,
  emailNote: {
    title: "Email keeps it vague on purpose",
    body: "Synthetic note. In production this text explains why a notification email never carries movement detail.",
  },
  settingsHref: "/showcase#alert-settings",
};
