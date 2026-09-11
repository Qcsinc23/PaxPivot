import type { ReactNode } from "react";

type Props = {
  /** The working list: routes, terminals or any ranked set. */
  list: ReactNode;
  /** The map or other wide context shown beside the list. */
  aside: ReactNode;
};

/**
 * Wide-viewport composition: the list sits beside the aside from 60rem up and stacks below that.
 * The layout lives in `styles/screens.css` as `minmax(0, 1fr)` tracks, so neither column can be
 * widened past its share by long content and the page never scrolls sideways.
 */
export function SplitLayout({ list, aside }: Props) {
  return (
    <div className="pp-split">
      <div>{list}</div>
      <div>{aside}</div>
    </div>
  );
}
