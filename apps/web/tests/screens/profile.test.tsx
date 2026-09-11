import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import ProfileLivePage from "@/app/profile/page";
import { EligibilityDetailScreen } from "@/components/screens/profile/EligibilityDetailScreen";
import { ProfileScreen } from "@/components/screens/profile/ProfileScreen";
import { ReadinessScreen } from "@/components/screens/profile/ReadinessScreen";
import { unknown } from "@/lib/presentation/fact";
import {
  emptyEligibilityDetail,
  emptyProfile,
  fixtureEligibilityDetail,
  fixtureProfile,
} from "@/lib/presentation/screens/profile";
import { expectNoAxeViolations } from "../a11y";

/** Terms that must never appear in a profile or eligibility surface. */
const FORBIDDEN_FIELDS = [
  "medical",
  "passport",
  "credential",
  "birth date",
  "date of birth",
  "social security",
];

function readinessScreen(model = fixtureProfile) {
  return (
    <ReadinessScreen
      status={model.status}
      model={model.readiness}
      backHref="/showcase/profile"
    />
  );
}

describe("ProfileScreen", () => {
  test("uses traveler wording and links to the eligibility detail", () => {
    render(<ProfileScreen model={fixtureProfile} />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
      "Profile",
    );
    expect(screen.getByText("Eligible · 2 travelers")).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Why this eligibility decision?" })
        .getAttribute("href"),
    ).toBe(fixtureProfile.eligibility.detailHref);
  });

  test("takes the eligibility state and count from the model", () => {
    const { unmount } = render(
      <ProfileScreen
        model={{
          ...fixtureProfile,
          eligibility: { state: "unknown", travelerCount: 1 },
        }}
      />,
    );
    expect(screen.getByText("Eligibility unknown · 1 traveler")).toBeTruthy();
    expect(screen.queryByText(/Eligible · 2 travelers/)).toBeNull();
    unmount();

    render(
      <ProfileScreen
        model={{
          ...fixtureProfile,
          eligibility: { state: "outside_supported_scope", travelerCount: 3 },
        }}
      />,
    );
    expect(
      screen.getByText("Outside supported scope · 3 travelers"),
    ).toBeTruthy();
  });

  test("lists the party in traveler wording", () => {
    render(<ProfileScreen model={fixtureProfile} />);
    const party = screen.getByRole("list", { name: "Travel party" });
    expect(within(party).getAllByRole("listitem")).toHaveLength(
      fixtureProfile.party.length,
    );
    expect(within(party).getByText("Sponsor · traveling")).toBeTruthy();
    expect(within(party).getByText("Dependent · accompanied")).toBeTruthy();
  });

  test("shows the readiness summary without listing the checklist", () => {
    render(<ProfileScreen model={fixtureProfile} />);
    expect(screen.getByText("2 of 4 ready")).toBeTruthy();
    expect(
      screen.getByRole("progressbar", { name: "Before you go" }),
    ).toBeTruthy();
    // The checklist itself belongs to the readiness screen.
    expect(screen.queryByRole("list", { name: "Readiness" })).toBeNull();
  });

  test("an unknown readiness reads Unknown and draws no bar", () => {
    render(
      <ProfileScreen
        model={{
          ...fixtureProfile,
          readiness: {
            ...fixtureProfile.readiness,
            done: unknown("Not started"),
            total: unknown(),
          },
        }}
      />,
    );

    const card = screen
      .getByRole("heading", { name: "Before you go" })
      .closest("div") as HTMLElement;
    expect(within(card).getByText("Unknown")).toBeTruthy();
    expect(within(card).queryByRole("progressbar")).toBeNull();
    expect(screen.queryByText("0 of 4 ready")).toBeNull();
  });

  test("summarises notification preferences with a settings link", () => {
    render(<ProfileScreen model={fixtureProfile} />);
    expect(
      screen.getByRole("list", { name: "Notification preferences" }),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Notification settings" })
        .getAttribute("href"),
    ).toBe(fixtureProfile.notifications.href);
  });

  test("keeps category codes off the profile surface", () => {
    const { container } = render(<ProfileScreen model={fixtureProfile} />);
    expect(container.textContent).not.toContain("Category");
  });

  test("shows no medical, document or credential fields", () => {
    const { container } = render(<ProfileScreen model={fixtureProfile} />);
    const text = (container.textContent ?? "").toLowerCase();
    for (const forbidden of FORBIDDEN_FIELDS) {
      expect(text).not.toContain(forbidden);
    }
  });
});

describe("ReadinessScreen", () => {
  test("shows progress and the checklist", () => {
    render(readinessScreen());

    expect(
      screen.getByRole("progressbar", { name: "Before you go" }),
    ).toBeTruthy();
    expect(screen.getByText("2 of 4 ready")).toBeTruthy();
    const list = screen.getByRole("list", { name: "Readiness" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(
      fixtureProfile.readiness.items.length,
    );
  });

  test("keeps each item's policy text behind a closed Why?", () => {
    const { container } = render(readinessScreen());

    const disclosures = container.querySelectorAll("details");
    expect(disclosures.length).toBeGreaterThan(0);
    expect(container.querySelectorAll("details[open]")).toHaveLength(0);
    expect(screen.getAllByText("Why?").length).toBeGreaterThan(0);
  });

  test("has exactly one accent action, on the unresolved card", () => {
    const { container } = render(readinessScreen());

    const accents = container.querySelectorAll('[data-variant="accent"]');
    expect(accents).toHaveLength(1);
    const unresolved = fixtureProfile.readiness.unresolved;
    expect(accents[0]?.textContent).toBe(unresolved?.acknowledgeLabel);
    expect(
      screen.getByRole("heading", { name: unresolved?.title }),
    ).toBeTruthy();
    expect(screen.getByText(unresolved?.body as string)).toBeTruthy();
  });

  test("offers the mark-ready action in a sticky bar, not as the accent", () => {
    render(readinessScreen());
    const actions = screen.getByRole("group", { name: "Readiness actions" });
    const markReady = within(actions).getByRole("button", {
      name: fixtureProfile.readiness.markReadyLabel,
    });
    expect(markReady.getAttribute("data-variant")).not.toBe("accent");
  });

  test("an unknown readiness reads Unknown and draws no bar", () => {
    render(
      readinessScreen({
        ...fixtureProfile,
        readiness: {
          ...fixtureProfile.readiness,
          done: unknown(),
          total: unknown(),
        },
      }),
    );
    expect(screen.getByText("Unknown")).toBeTruthy();
    expect(
      screen.queryByRole("progressbar", { name: "Before you go" }),
    ).toBeNull();
  });

  test("renders no unresolved card when the model has none", () => {
    const { container } = render(
      readinessScreen({
        ...fixtureProfile,
        readiness: { ...fixtureProfile.readiness, unresolved: undefined },
      }),
    );
    expect(container.querySelectorAll('[data-variant="accent"]')).toHaveLength(
      0,
    );
  });
});

describe("EligibilityDetailScreen", () => {
  test("states the decision, the controlling policy and its version as text", () => {
    render(<EligibilityDetailScreen model={fixtureEligibilityDetail} />);

    expect(screen.getByText("Eligible")).toBeTruthy();
    expect(screen.getByText("Controlling policy")).toBeTruthy();
    expect(screen.getByText(fixtureEligibilityDetail.policy.id)).toBeTruthy();
    expect(screen.getByText("Version")).toBeTruthy();
    expect(
      screen.getByText(fixtureEligibilityDetail.policy.version),
    ).toBeTruthy();
  });

  test("renders the citations, the reasons and the unresolved conditions", () => {
    render(<EligibilityDetailScreen model={fixtureEligibilityDetail} />);

    expect(screen.getByRole("list", { name: "Policy citations" })).toBeTruthy();
    for (const reason of fixtureEligibilityDetail.reasons) {
      expect(screen.getByText(reason)).toBeTruthy();
    }
    expect(
      screen.getByRole("list", { name: "Unresolved conditions" }),
    ).toBeTruthy();
    for (const condition of fixtureEligibilityDetail.unresolved) {
      expect(screen.getByText(condition)).toBeTruthy();
    }
  });

  test("shows the traveler rows, which is where category wording lives", () => {
    render(<EligibilityDetailScreen model={fixtureEligibilityDetail} />);

    const travelers = screen.getByRole("list", { name: "Travelers" });
    expect(within(travelers).getAllByRole("listitem")).toHaveLength(
      fixtureEligibilityDetail.travelers.length,
    );
    expect(within(travelers).getAllByText(/Category 6/).length).toBe(
      fixtureEligibilityDetail.travelers.length,
    );
  });

  test("shows no medical, document or credential fields", () => {
    const { container } = render(
      <EligibilityDetailScreen model={fixtureEligibilityDetail} />,
    );
    const text = (container.textContent ?? "").toLowerCase();
    for (const forbidden of FORBIDDEN_FIELDS) {
      expect(text).not.toContain(forbidden);
    }
  });

  test("says so when nothing is outstanding", () => {
    render(
      <EligibilityDetailScreen
        model={{ ...fixtureEligibilityDetail, unresolved: [] }}
      />,
    );
    expect(screen.getByText("Nothing is outstanding.")).toBeTruthy();
    expect(
      screen.queryByRole("list", { name: "Unresolved conditions" }),
    ).toBeNull();
  });
});

describe("profile states and live routes", () => {
  test("profile empty, loading and error claim nothing", () => {
    const { unmount } = render(<ProfileScreen model={emptyProfile} />);
    expect(
      screen.getByRole("heading", { name: "No profile yet" }),
    ).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Travel party" })).toBeNull();
    unmount();

    const loading = render(
      <ProfileScreen model={{ ...fixtureProfile, status: "loading" }} />,
    );
    expect(screen.getByRole("status")).toBeTruthy();
    loading.unmount();

    render(<ProfileScreen model={{ ...fixtureProfile, status: "error" }} />);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText(/failure on our side/)).toBeTruthy();
  });

  test("readiness empty, loading and error claim nothing", () => {
    const { unmount } = render(
      readinessScreen({ ...fixtureProfile, status: "empty" }),
    );
    expect(
      screen.getByRole("heading", { name: "Nothing to check yet" }),
    ).toBeTruthy();
    unmount();

    const loading = render(
      readinessScreen({ ...fixtureProfile, status: "loading" }),
    );
    expect(screen.getByRole("status")).toBeTruthy();
    loading.unmount();

    render(readinessScreen({ ...fixtureProfile, status: "error" }));
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  test("eligibility empty, loading and error claim nothing", () => {
    const { unmount } = render(
      <EligibilityDetailScreen model={emptyEligibilityDetail} />,
    );
    expect(
      screen.getByRole("heading", { name: "No eligibility decision yet" }),
    ).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Travelers" })).toBeNull();
    unmount();

    const loading = render(
      <EligibilityDetailScreen
        model={{ ...fixtureEligibilityDetail, status: "loading" }}
      />,
    );
    expect(screen.getByRole("status")).toBeTruthy();
    loading.unmount();

    render(
      <EligibilityDetailScreen
        model={{ ...fixtureEligibilityDetail, status: "error" }}
      />,
    );
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  test("live /profile renders the empty state and no fixture data", () => {
    render(<ProfileLivePage />);
    expect(
      screen.getByRole("heading", { name: "No profile yet" }),
    ).toBeTruthy();
    expect(screen.queryByText(/Example|\(example\)/)).toBeNull();
    expect(screen.queryByText("Eligible · 2 travelers")).toBeNull();
  });
});

describe("accessibility", () => {
  test("has no axe violations across all three screens and their states", async () => {
    const profileModels = [
      fixtureProfile,
      { ...fixtureProfile, status: "loading" as const },
      { ...fixtureProfile, status: "error" as const },
      emptyProfile,
    ];
    for (const model of profileModels) {
      const { container, unmount } = render(<ProfileScreen model={model} />);
      await expectNoAxeViolations(container, ["region"]);
      unmount();
    }

    for (const status of ["ready", "empty", "loading", "error"] as const) {
      const { container, unmount } = render(
        readinessScreen({ ...fixtureProfile, status }),
      );
      await expectNoAxeViolations(container, ["region"]);
      unmount();
    }

    for (const status of ["ready", "empty", "loading", "error"] as const) {
      const model =
        status === "ready"
          ? fixtureEligibilityDetail
          : { ...fixtureEligibilityDetail, status };
      const { container, unmount } = render(
        <EligibilityDetailScreen model={model} />,
      );
      await expectNoAxeViolations(container, ["region"]);
      unmount();
    }
  });
});
