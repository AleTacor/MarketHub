import { useEffect, useState, type ReactNode } from "react";

/** Matches the duration-300 transitions below, plus a margin. */
const UNFOLD_MS = 350;

/**
 * Below `lg`, folds its content away with an animation: the content slides up (as if
 * hiding behind whatever is above it) and fades, while its height shrinks to 0. The
 * height animates through `grid-template-rows` 1fr → 0fr, which works with any content
 * height. Once folded it is `invisible`, so it leaves the tab order and the
 * accessibility tree. On desktop it is always open, whatever `collapsed` says.
 *
 * Content stays mounted (a map keeps its drawn area and view) and keeps its size, so
 * Leaflet doesn't need to re-measure.
 *
 * It only clips its content while folded or unfolding: once open, popups inside it (the
 * type combobox's list) can extend past its bottom edge.
 */
export function MobileFold({
  id,
  collapsed,
  animated = true,
  className = "",
  innerClassName = "",
  children,
}: {
  id?: string;
  collapsed: boolean;
  /** False: change state instantly (e.g. folding on page load, which shouldn't slide). */
  animated?: boolean;
  /** On the outer element (spacing in the parent layout). */
  className?: string;
  /** On the sliding element (e.g. `max-lg:pt-6`: spacing that should fold away too). */
  innerClassName?: string;
  children: ReactNode;
}) {
  // Unfolding: keep clipping until the content has slid back in.
  const [unfolding, setUnfolding] = useState(false);
  useEffect(() => {
    if (collapsed || !animated) return setUnfolding(false);
    setUnfolding(true);
    const timer = setTimeout(() => setUnfolding(false), UNFOLD_MS);
    return () => clearTimeout(timer);
  }, [collapsed, animated]);
  const clip = collapsed || unfolding;

  return (
    <div
      id={id}
      data-collapsed={collapsed}
      data-animated={animated}
      className={`grid ${animated ? "transition-[grid-template-rows,visibility] duration-300 ease-in-out motion-reduce:transition-none" : ""} lg:!visible lg:!grid-rows-[1fr] ${
        collapsed ? "max-lg:invisible max-lg:grid-rows-[0fr]" : "grid-rows-[1fr]"
      } ${className}`}
    >
      <div className={`min-h-0 ${clip ? "max-lg:overflow-hidden" : ""}`}>
        <div
          className={`h-full ${animated ? "transition duration-300 ease-in-out motion-reduce:transition-none" : ""} ${
            collapsed ? "max-lg:-translate-y-full max-lg:opacity-0" : ""
          } ${innerClassName}`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
