type Props = {
  label: string;
  value: number;
  max?: number;
};

/** Determinate progress only. Indeterminate waiting uses `LoadingState`. */
export function Progress({ label, value, max = 100 }: Props) {
  const safeMax = Math.max(max, 1);
  const clamped = Math.min(Math.max(value, 0), safeMax);
  return (
    <div
      className="pp-progress"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={clamped}
    >
      <span style={{ width: `${(clamped / safeMax) * 100}%` }} />
    </div>
  );
}
