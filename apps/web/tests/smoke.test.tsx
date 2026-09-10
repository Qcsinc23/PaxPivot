import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Home from "../app/page";
test("scaffold is honest about unavailable planning", () => {
  const html = renderToStaticMarkup(<Home />);
  expect(html).toContain("Journey planning is not available yet");
  expect(html).toContain("not guaranteed");
  expect(html).not.toContain("<form");
});
