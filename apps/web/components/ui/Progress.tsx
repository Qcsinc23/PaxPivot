type Props = {
  label: string;
  value: number;
  max?: number;
};

/** Determinate progress only. Indeterminate waiting uses `LoadingState`. */
export function Progress({ label, value, max = 100 }: Props) {
  const clamped = Math.min(Math.max(value, 0), max);
  return (
    <div
      className="pp-progress"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={clamped}
    >
      <span style={{ width: `${(clamped / max) * 100}%` }} />
    </div>
  );
}
