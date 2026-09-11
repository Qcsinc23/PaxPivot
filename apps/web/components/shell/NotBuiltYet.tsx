import { AppHeader } from "@/components/ui/AppHeader";
import { EmptyState } from "@/components/ui/States";

/** Route stub for a navigation destination whose screen task has not merged yet. */
export function NotBuiltYet({ title }: { title: string }) {
  return (
    <>
      <AppHeader title={title} />
      <EmptyState
        title="Not available yet"
        body={`${title} is not available in this build.`}
      />
    </>
  );
}
