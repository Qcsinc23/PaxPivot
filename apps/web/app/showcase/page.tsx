import { notFound } from "next/navigation";
import { Showcase } from "@/components/showcase/Showcase";

/** Development-only component gallery driven by synthetic fixtures. */
export default function ShowcasePage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Showcase />;
}
