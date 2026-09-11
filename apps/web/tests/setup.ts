import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

declare global {
  // Pathname reported by the mocked next/navigation; tests set it per case.
  var __paxpivotPathname: string;
}

globalThis.__paxpivotPathname = "/";

vi.mock("next/navigation", () => ({
  usePathname: () => globalThis.__paxpivotPathname,
  notFound: () => {
    throw new Error("notFound");
  },
}));

afterEach(cleanup);

// jsdom has no modal dialog implementation; mirror the open attribute and close event.
if (
  typeof HTMLDialogElement !== "undefined" &&
  !HTMLDialogElement.prototype.showModal
) {
  HTMLDialogElement.prototype.showModal = function showModal(
    this: HTMLDialogElement,
  ) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
}
