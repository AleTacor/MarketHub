import { useEffect, useRef, type RefObject } from "react";

/**
 * Calls `onLoadMore` when `sentinel` (an element at the end of a list) scrolls into
 * view inside `root` (the scroll container), with `rootMargin` of lookahead.
 * Does nothing while `enabled` is false (no more pages, or one is loading).
 * Without IntersectionObserver it does nothing: keep a "load more" button as fallback.
 */
export function useInfiniteScroll({
  sentinel,
  root,
  enabled,
  onLoadMore,
  rootMargin = "200px",
}: {
  sentinel: RefObject<Element | null>;
  root: RefObject<Element | null>;
  enabled: boolean;
  onLoadMore: () => void;
  rootMargin?: string;
}) {
  const callback = useRef(onLoadMore);
  callback.current = onLoadMore;

  useEffect(() => {
    const target = sentinel.current;
    if (!enabled || !target || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && callback.current(), {
      root: root.current,
      rootMargin,
    });
    observer.observe(target);
    // Re-created when `enabled` flips back on after a page loads: if the sentinel is still
    // visible (short pages, tall screen), the new observer fires again and loads the next one.
    return () => observer.disconnect();
  }, [enabled, sentinel, root, rootMargin]);
}
