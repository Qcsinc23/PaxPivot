type Props = { width?: string; height?: string };

/** Decorative placeholder; the containing `LoadingState` announces what is pending. */
export function Skeleton({ width = "100%", height = "1rem" }: Props) {
  return (
    <span
      className="pp-skeleton"
      aria-hidden="true"
      style={{ width, height }}
    />
  );
}
