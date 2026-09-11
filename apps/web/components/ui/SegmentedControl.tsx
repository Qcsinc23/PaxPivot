"use client";

import { useId } from "react";

export type SegmentOption<V extends string> = { value: V; label: string };

type Props<V extends string> = {
  /** Accessible group name, e.g. "Sort routes". */
  label: string;
  value: V;
  options: readonly SegmentOption<V>[];
  onChange: (value: V) => void;
};

/** Single-choice chips built on native radio inputs: keyboard and screen-reader behaviour for free. */
export function SegmentedControl<V extends string>({
  label,
  value,
  options,
  onChange,
}: Props<V>) {
  const name = useId();
  return (
    <fieldset className="pp-seg">
      <legend className="sr-only">{label}</legend>
      {options.map((option) => (
        <label key={option.value} className="pp-chip">
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={option.value === value}
            onChange={() => onChange(option.value)}
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}
