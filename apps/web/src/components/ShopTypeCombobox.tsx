"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { ShopType } from "@markethub/shared";

/** Lowercase without accents, so "clinica" finds "Clínica y centro médico". */
const normalize = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

type Option = { id: number | null; name: string };

/**
 * Business type picker that can be typed into: a combobox (ARIA 1.2 pattern) whose list
 * filters as the user types, ignoring case and accents. Arrow keys move, Enter picks,
 * Escape closes; leaving the field keeps an exactly typed name and otherwise goes back to
 * the current choice. With `emptyLabel`, "no type" is an option too (and clearing the text
 * picks it). With `name`, the chosen id is also posted in a hidden input, for FormData.
 *
 * The list is positioned below the field, so no ancestor may clip it (see MobileFold).
 */
export function ShopTypeCombobox({
  id,
  types,
  value,
  onChange,
  emptyLabel,
  placeholder,
  name,
  required,
}: {
  id: string;
  types: ShopType[];
  value: number | null;
  onChange: (id: number | null) => void;
  /** Label of the "no type" option ("Todos los tipos"), also the placeholder. Omit when a type is required. */
  emptyLabel?: string;
  placeholder?: string;
  name?: string;
  required?: boolean;
}) {
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  /** What the user typed since focusing; null while not typing (the field shows the choice). */
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);

  const selected = types.find((t) => t.id === value) ?? null;
  const options = useMemo<Option[]>(() => {
    const q = normalize(query ?? "");
    const matches = q ? types.filter((t) => normalize(t.name).includes(q)) : types;
    return emptyLabel !== undefined && !q ? [{ id: null, name: emptyLabel }, ...matches] : matches;
  }, [types, query, emptyLabel]);

  // Keep the highlighted option visible while moving with the keyboard.
  useEffect(() => {
    if (open) listRef.current?.children[active]?.scrollIntoView?.({ block: "nearest" });
  }, [open, active]);

  function openList() {
    if (open) return;
    setOpen(true);
    setActive(Math.max(0, options.findIndex((o) => o.id === value)));
  }

  function close() {
    setOpen(false);
    setQuery(null);
  }

  function choose(option: Option) {
    if (option.id !== value) onChange(option.id);
    close();
  }

  /** Leaving the field: an exactly typed name counts, anything else goes back to the choice. */
  function commit() {
    if (query !== null) {
      const q = normalize(query);
      if (!q && emptyLabel !== undefined) return choose({ id: null, name: emptyLabel });
      const exact = types.find((t) => normalize(t.name) === q);
      if (exact) return choose(exact);
    }
    close();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!open) openList();
        else setActive((i) => Math.min(i + 1, options.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        if (open) setActive((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        // While the list is open, Enter picks instead of submitting the form.
        if (!open) break;
        e.preventDefault();
        if (options[active]) choose(options[active]);
        break;
      case "Escape":
        if (!open) break;
        e.preventDefault();
        close();
        break;
    }
  }

  const optionId = (i: number) => `${listId}-${i}`;

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        role="combobox"
        className="input pr-9"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && options[active] ? optionId(active) : undefined}
        required={required}
        placeholder={placeholder ?? emptyLabel}
        value={query ?? selected?.name ?? ""}
        onFocus={(e) => e.target.select()}
        onClick={openList}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onKeyDown={handleKeyDown}
        onBlur={commit}
      />
      <svg
        viewBox="0 0 20 20"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" />
      </svg>
      {name && <input type="hidden" name={name} value={value ?? ""} />}

      {open && (
        <div className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-line bg-surface shadow-lift">
          {/* Rendered even when empty, so aria-controls always points at it. */}
          <ul ref={listRef} id={listId} role="listbox" aria-label="Tipos de negocio" className={`max-h-64 overflow-y-auto ${options.length ? "py-1" : ""}`}>
            {options.map((option, i) => (
              <li
                key={option.id ?? "all"}
                id={optionId(i)}
                role="option"
                aria-selected={option.id === value}
                // mousedown would blur the input (and commit) before the click lands.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(option)}
                onMouseMove={() => setActive(i)}
                className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm ${
                  i === active ? "bg-accent-soft text-accent" : option.id === null ? "text-fg-muted" : "text-fg"
                }`}
              >
                <span className="min-w-0">{option.name}</span>
                {option.id === value && (
                  <svg viewBox="0 0 20 20" className="h-4 w-4 flex-none" fill="currentColor" aria-hidden="true">
                    <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z" />
                  </svg>
                )}
              </li>
            ))}
          </ul>
          {options.length === 0 && <p className="px-3 py-2 text-sm text-fg-subtle">Ningún tipo coincide</p>}
        </div>
      )}
    </div>
  );
}
