"use client";

import {
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

export type TabItem = { id: string; label: string; panel: ReactNode };

type Props = {
  /** Accessible name of the tab list, e.g. "Route detail sections". */
  label: string;
  tabs: readonly TabItem[];
  defaultTab?: string;
  onChange?: (id: string) => void;
};

/** WAI-ARIA tabs with roving tabindex, arrow/Home/End keys and automatic activation. */
export function Tabs({ label, tabs, defaultTab, onChange }: Props) {
  const base = useId();
  const [active, setActive] = useState(
    tabs.some((tab) => tab.id === defaultTab)
      ? (defaultTab as string)
      : (tabs[0]?.id ?? ""),
  );
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const select = (index: number) => {
    const tab = tabs[index];
    if (!tab) return;
    setActive(tab.id);
    onChange?.(tab.id);
    refs.current[index]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = tabs.findIndex((tab) => tab.id === active);
    const last = tabs.length - 1;
    const next: Record<string, number> = {
      ArrowRight: current === last ? 0 : current + 1,
      ArrowLeft: current <= 0 ? last : current - 1,
      Home: 0,
      End: last,
    };
    const target = next[event.key];
    if (target === undefined) return;
    event.preventDefault();
    select(target);
  };

  return (
    <div className="pp-tabs">
      <div
        role="tablist"
        aria-label={label}
        className="pp-tabs__list"
        onKeyDown={onKeyDown}
      >
        {tabs.map((tab, index) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              ref={(element) => {
                refs.current[index] = element;
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${tab.id}`}
              className="pp-tab"
              aria-selected={selected}
              aria-controls={`${base}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(index)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${base}-panel-${tab.id}`}
          aria-labelledby={`${base}-tab-${tab.id}`}
          className="pp-tabs__panel"
          hidden={tab.id !== active}
          tabIndex={0}
        >
          {tab.panel}
        </div>
      ))}
    </div>
  );
}
