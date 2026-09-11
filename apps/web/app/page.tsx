import { PlanScreen } from "@/components/screens/plan/PlanScreen";
import { emptyPlan } from "@/lib/presentation/screens/plan";

/**
 * Live Plan route. No trip-request API contract exists yet, so this renders the honest empty
 * model: no synthetic trips, terminals or source states are presented as if they were real.
 */
export default function PlanPage() {
  return <PlanScreen model={emptyPlan} />;
}
