import type { ReactNode } from "react";

type Props = {
  /** The working list: routes, terminals or any ranked set. */
  list: ReactNode;
  /** The map or other wide context shown beside the list. */
  aside: ReactNode;
  /**
   * Render the aside first in the document (it stacks above the list on narrow viewports) while
   * CSS still places it in the right-hand column from 60rem up. Results uses this so the map
   * stays on top on a phone and beside the list on a desktop with a single tree.
   */
  asideFirst?: boolean;
};

/**
 * Wide-viewport composition: the list sits beside the aside from 60rem up and stacks below that.
 * The layout lives in `styles/screens.css` as `minmax(0, 1fr)` tracks, so neither column can be
 * widened past its share by long content and the page never scrolls sideways.
 */
export function SplitLayout({ list, aside, asideFirst = false }: Props) {
  const className = asideFirst ? "pp-split pp-split--aside-first" : "pp-split";
  return asideFirst ? (
    <div className={className}>
      <div>{aside}</div>
      <div>{list}</div>
    </div>
  ) : (
    <div className={className}>
      <div>{list}</div>
      <div>{aside}</div>
    </div>
  );
}
