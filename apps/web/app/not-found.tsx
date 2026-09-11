import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";

/** The address does not exist; that is a statement about the URL, never about the world. */
export default function NotFound() {
  return (
    <EmptyState
      title="That page does not exist"
      body="Check the address, or start from Plan."
      action={<Button href="/">Go to Plan</Button>}
    />
  );
}
