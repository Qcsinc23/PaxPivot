import { PlanScreen } from "@/components/screens/plan/PlanScreen";
import { fixturePlan } from "@/lib/presentation/screens/plan";

/** Development-only gallery: the Plan screen rendered from its synthetic fixture. */
export default function ShowcasePlanPage() {
  return <PlanScreen model={fixturePlan} />;
}
