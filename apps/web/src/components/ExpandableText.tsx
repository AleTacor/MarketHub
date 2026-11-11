"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Text clamped to a few lines, with "Ver más" / "Ver menos" when it doesn't fit.
 * Keeps cards the same height regardless of how long one description is.
 */
export function ExpandableText({ text, className = "" }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  // Measure while clamped; re-measure when the width changes (resize, grid columns).
  useEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;
    const measure = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text, expanded]);

  return (
    <div>
      <p ref={ref} className={`break-anywhere whitespace-pre-line ${expanded ? "" : "line-clamp-3"} ${className}`}>
        {text}
      </p>
      {(overflows || expanded) && (
        <button
          type="button"
          className="mt-1 text-sm font-medium text-accent hover:underline"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Ver menos" : "Ver más"}
        </button>
      )}
    </div>
  );
}
