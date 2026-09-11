import { notFound } from "next/navigation";
import type { ReactNode } from "react";

/** Everything under /showcase is a development-only, fixture-driven gallery. */
export default function ShowcaseLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return children;
}
