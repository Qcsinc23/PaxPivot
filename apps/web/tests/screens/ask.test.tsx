import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import AskLivePage from "@/app/ask/page";
import { AskScreen } from "@/components/screens/ask/AskScreen";
import { askGroundingText } from "@/lib/presentation/ask";
import {
  fixtureAskAnswer,
  fixtureAskAnswerUnknown,
} from "@/lib/presentation/fixtures";
import {
  MOBILE_NAV,
  RAIL_PRIMARY,
  RAIL_SECONDARY,
} from "@/lib/presentation/navigation";
import {
  emptyAsk,
  fixtureAsk,
  fixtureAskUnknown,
} from "@/lib/presentation/screens/ask";
import { expectNoAxeViolations } from "../a11y";

describe("Ask answer card", () => {
  test("renders the question, the verdict pill and its title from the model", () => {
    render(<AskScreen model={fixtureAsk} />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Ask PaxPivot",
    );
    expect(
      screen.getByText(`You asked: ${fixtureAskAnswer.question}`),
    ).toBeTruthy();
    expect(screen.getByText("Recommendation")).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: fixtureAskAnswer.verdict.title }),
    ).toBeTruthy();
    expect(screen.getByText(fixtureAskAnswer.explanation)).toBeTruthy();
  });

  test("an unknown verdict says Unknown verbatim, not a substituted opinion", () => {
    render(<AskScreen model={fixtureAskUnknown} />);

    // The fixture title deliberately does not contain the word, so this proves the pill.
    expect(fixtureAskAnswerUnknown.verdict.title).not.toContain("Unknown");
    expect(screen.getByText("Unknown")).toBeTruthy();
    expect(screen.queryByText("Recommendation")).toBeNull();
    expect(screen.queryByText("Needs clarification")).toBeNull();
    expect(
      screen.getByRole("heading", {
        name: fixtureAskAnswerUnknown.verdict.title,
      }),
    ).toBeTruthy();
  });

  test("a clarification verdict uses its own wording", () => {
    render(
      <AskScreen
        model={{
          ...fixtureAsk,
          answer: {
            ...fixtureAskAnswer,
            verdict: {
              title: "Which terminal are you leaving from?",
              kind: "clarification",
            },
          },
        }}
      />,
    );
    expect(screen.getByText("Needs clarification")).toBeTruthy();
  });

  test("renders the actions the model supplies, with their variants", () => {
    render(<AskScreen model={fixtureAsk} />);

    for (const action of fixtureAskAnswer.actions) {
      const link = screen.getByRole("link", { name: action.label });
      expect(link.getAttribute("href")).toBe(action.href);
      expect(link.getAttribute("data-variant")).toBe(action.variant);
    }
  });

  test("renders the grounding line from the model's counts", () => {
    render(<AskScreen model={fixtureAsk} />);

    expect(askGroundingText(fixtureAskAnswer.grounding)).toBe(
      "Based on 1 route search · 2 source records",
    );
    expect(
      screen.getByText("Based on 1 route search · 2 source records"),
    ).toBeTruthy();
  });

  test("states explicitly when there is no grounding at all", () => {
    render(
      <AskScreen
        model={{
          ...fixtureAsk,
          answer: { ...fixtureAskAnswer, grounding: [] },
        }}
      />,
    );
    expect(screen.getByText("Based on no structured records")).toBeTruthy();
  });
});

describe("Ask comparison table", () => {
  test("is a real table with a caption, column headers and row headers", () => {
    render(<AskScreen model={fixtureAsk} />);

    const comparison = fixtureAskAnswer.comparison;
    expect(comparison).toBeTruthy();
    const table = screen.getByRole("table", {
      name: "What the answer compared",
    });
    expect(table.className).toBe("pp-table");
    expect(table.parentElement?.className).toBe("pp-table-wrap");
    expect(within(table).getAllByRole("columnheader")).toHaveLength(
      (comparison?.options.length ?? 0) + 1,
    );
    expect(within(table).getAllByRole("rowheader")).toHaveLength(
      comparison?.rows.length ?? 0,
    );
  });

  test("carries the model's emphasis and decides none itself", () => {
    const { container } = render(<AskScreen model={fixtureAsk} />);

    const cells = Array.from(container.querySelectorAll(".pp-table td"));
    const emphasised = cells.filter((cell) =>
      cell.hasAttribute("data-emphasis"),
    );
    const modelled = (fixtureAskAnswer.comparison?.rows ?? []).flatMap((row) =>
      row.cells.filter((cell) => cell.emphasis !== "none"),
    );
    expect(emphasised).toHaveLength(modelled.length);
    for (const cell of emphasised) {
      expect(["better", "tie"]).toContain(
        cell.getAttribute("data-emphasis") ?? "",
      );
    }
  });

  test("omits the table entirely when the answer built no comparison", () => {
    render(
      <AskScreen
        model={{
          ...fixtureAsk,
          answer: { ...fixtureAskAnswer, comparison: undefined },
        }}
      />,
    );
    expect(screen.queryByRole("table")).toBeNull();
  });
});

describe("Ask follow-ups and composer", () => {
  test("suggests the model's follow-up questions", () => {
    render(<AskScreen model={fixtureAsk} />);

    const suggestions = screen.getByRole("list", {
      name: "Suggested questions",
    });
    expect(within(suggestions).getAllByRole("listitem")).toHaveLength(
      fixtureAskAnswer.followUps.length,
    );
    for (const followUp of fixtureAskAnswer.followUps) {
      expect(within(suggestions).getByText(followUp)).toBeTruthy();
    }
  });

  test("the composer is present, labelled and disabled with the model's placeholder", () => {
    render(<AskScreen model={emptyAsk} />);

    const composer = screen.getByLabelText("Ask a question");
    expect(composer.tagName).toBe("TEXTAREA");
    expect(composer).toHaveProperty("disabled", true);
    expect(composer.getAttribute("placeholder")).toBe(
      emptyAsk.composerPlaceholder,
    );
    // The submit control is present but unavailable until the tool contract exists.
    expect(screen.getByRole("button", { name: "Ask" })).toHaveProperty(
      "disabled",
      true,
    );
  });
});

describe("Ask navigation", () => {
  test("is closed with a labelled control and is never a navigation destination", () => {
    render(<AskScreen model={fixtureAsk} />);

    expect(
      screen
        .getByRole("link", { name: "Close Ask PaxPivot" })
        .getAttribute("href"),
    ).toBe("/");
    const keys = [
      ...MOBILE_NAV.map((d) => d.key),
      ...RAIL_PRIMARY.map((d) => d.key),
      ...RAIL_SECONDARY.map((d) => d.key),
    ];
    expect(keys).not.toContain("ask");
    for (const destination of [
      ...MOBILE_NAV,
      ...RAIL_PRIMARY,
      ...RAIL_SECONDARY,
    ]) {
      expect(destination.href).not.toBe("/ask");
    }
  });
});

describe("Ask states and live route", () => {
  test("empty shows no answer and claims nothing", () => {
    render(<AskScreen model={emptyAsk} />);

    expect(
      screen.getByRole("heading", {
        name: "Ask PaxPivot is not connected yet",
      }),
    ).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByText("Recommendation")).toBeNull();
    expect(screen.getByLabelText("Ask a question")).toBeTruthy();
  });

  test("loading and error keep the composer and invent no answer", () => {
    const { unmount } = render(
      <AskScreen model={{ ...fixtureAsk, status: "loading" }} />,
    );
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByLabelText("Ask a question")).toBeTruthy();
    unmount();

    render(<AskScreen model={{ ...fixtureAsk, status: "error" }} />);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  test("a ready model with no answer is an error, never an invented answer", () => {
    render(<AskScreen model={{ ...fixtureAsk, answer: undefined }} />);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.queryByText("Recommendation")).toBeNull();
  });

  test("live /ask renders the empty model and no synthetic answer", () => {
    render(<AskLivePage />);

    expect(
      screen.getByRole("heading", {
        name: "Ask PaxPivot is not connected yet",
      }),
    ).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByText(/Example /)).toBeNull();
    expect(screen.queryByText("Recommendation")).toBeNull();
  });
});

describe("Ask accessibility", () => {
  test("has no axe violations in every state", async () => {
    const models = [
      fixtureAsk,
      fixtureAskUnknown,
      emptyAsk,
      { ...fixtureAsk, status: "loading" as const },
      { ...fixtureAsk, status: "error" as const },
    ];
    for (const model of models) {
      const { container, unmount } = render(<AskScreen model={model} />);
      await expectNoAxeViolations(container, ["region"]);
      unmount();
    }
  });
});
