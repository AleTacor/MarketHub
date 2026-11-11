"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Labelled text input or textarea with a live "56/1000" character counter.
 * Uncontrolled (works with `defaultValue`, FormData and `form.reset()`).
 */
export function TextField({
  id,
  name,
  label,
  maxLength,
  defaultValue = "",
  multiline = false,
  required,
  placeholder,
  className = "",
}: {
  id: string;
  name: string;
  label: string;
  maxLength: number;
  defaultValue?: string;
  multiline?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const [length, setLength] = useState(defaultValue.length);

  useEffect(() => setLength(defaultValue.length), [defaultValue]);

  // form.reset() restores the value without an input event; read it once it has.
  useEffect(() => {
    const form = ref.current?.form;
    if (!form) return;
    const onReset = () => setTimeout(() => setLength(ref.current?.value.length ?? 0));
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, []);

  const props = {
    ref,
    id,
    name,
    required,
    placeholder,
    maxLength,
    defaultValue,
    "aria-describedby": `${id}-count`,
    className: `input ${className}`,
    onChange: (e: { currentTarget: { value: string } }) => setLength(e.currentTarget.value.length),
  };

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label className="label" htmlFor={id}>
          {label}
        </label>
        <span id={`${id}-count`} className={`text-xs tabular-nums ${length >= maxLength ? "text-danger" : "text-fg-subtle"}`}>
          {length}/{maxLength}{" "}
          <span className="sr-only">caracteres</span>
        </span>
      </div>
      {multiline ? <textarea {...props} /> : <input {...props} />}
    </div>
  );
}
