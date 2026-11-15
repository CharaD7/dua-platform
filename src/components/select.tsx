"use client";

import {
  Children,
  Fragment,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

type Option = {
  value: string;
  label: string;
  disabled?: boolean;
};

type SelectProps = {
  id?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (value: string) => void;
  children?: ReactNode;
  className?: string;
  title?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  [key: `data-${string}`]: string | number | boolean | undefined;
};

function optionLabel(children: ReactNode): string {
  return Children.toArray(children)
    .map((child) => (typeof child === "string" || typeof child === "number" ? String(child) : ""))
    .join("")
    .trim();
}

function readOptions(children: ReactNode): Option[] {
  const options: Option[] = [];

  for (const child of Children.toArray(children)) {
    if (!isValidElement(child)) continue;

    if (child.type === Fragment) {
      options.push(...readOptions((child.props as { children?: ReactNode }).children));
      continue;
    }

    if (child.type !== "option") continue;
    const props = child.props as {
      value?: string | number;
      disabled?: boolean;
      children?: ReactNode;
    };
    const label = optionLabel(props.children);
    options.push({
      value: String(props.value ?? label),
      label,
      disabled: props.disabled,
    });
  }

  return options;
}

/**
 * A styled select that keeps the familiar `<option>` children used by the
 * forms, but replaces the operating-system menu with a theme-aware listbox.
 *
 * The value is submitted through a hidden input, so server actions and Zod
 * validation continue to receive the same field names. Required fields are
 * still validated on the server; the visible control also exposes
 * `aria-required` for assistive technology.
 */
export function Select({
  id,
  name,
  required,
  disabled,
  value,
  defaultValue = "",
  onChange,
  children,
  className = "",
  title,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  ...data
}: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? `dua-select-${generatedId}`;
  const listId = `${selectId}-listbox`;
  const options = readOptions(children);
  const [internal, setInternal] = useState(String(defaultValue));
  const current = value !== undefined ? String(value) : internal;
  const selected = options.find((option) => option.value === current);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function closeOnOutside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutside);
    return () => document.removeEventListener("pointerdown", closeOnOutside);
  }, [open]);

  function openList() {
    if (disabled) return;
    const selectedIndex = options.findIndex((option) => option.value === current);
    setActive(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  }

  function closeList() {
    setOpen(false);
  }

  function commit(next: string) {
    if (value === undefined) setInternal(next);
    onChange?.(next);
    closeList();
    buttonRef.current?.focus();
  }

  function moveActive(direction: 1 | -1) {
    if (options.length === 0) return;
    setActive((index) => {
      let next = index;
      for (let step = 0; step < options.length; step += 1) {
        next = (next + direction + options.length) % options.length;
        if (!options[next].disabled) return next;
      }
      return index;
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!open) openList();
        else moveActive(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        if (!open) openList();
        else moveActive(-1);
        break;
      case "Home":
        if (open) {
          event.preventDefault();
          setActive(0);
        }
        break;
      case "End":
        if (open) {
          event.preventDefault();
          setActive(options.length - 1);
        }
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        if (open && options[active] && !options[active].disabled) commit(options[active].value);
        else if (!open) openList();
        else closeList();
        break;
      case "Escape":
        if (open) {
          event.preventDefault();
          closeList();
        }
        break;
      case "Tab":
        closeList();
        break;
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        {...data}
        ref={buttonRef}
        id={selectId}
        type="button"
        title={title}
        role="combobox"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && options[active] ? `${selectId}-option-${active}` : undefined}
        aria-required={required}
        disabled={disabled}
        onClick={() => (open ? closeList() : openList())}
        onKeyDown={onKeyDown}
        className={`field-input mt-1 flex w-full items-center justify-between gap-2 text-left ${className}`}
      >
        <span className={selected && selected.value !== "" ? "text-bone" : "text-dust/80"}>
          {selected?.label ?? "Select…"}
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className={`h-4 w-4 shrink-0 text-dust transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m5 7.5 5 5 5-5" />
        </svg>
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-labelledby={selectId}
          className="absolute z-[100] mt-1 max-h-72 w-full overflow-auto rounded-lg border border-line bg-ink-2 p-1 shadow-2xl"
        >
          {options.map((option, index) => {
            const isSelected = option.value === current;
            return (
              <li
                key={`${option.value}-${index}`}
                id={`${selectId}-option-${index}`}
                role="option"
                aria-selected={isSelected}
                aria-disabled={option.disabled}
                onPointerDown={(event) => {
                  event.preventDefault();
                  if (!option.disabled) commit(option.value);
                }}
                onMouseEnter={() => !option.disabled && setActive(index)}
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-sm ${
                  index === active ? "bg-ink-4 text-bone" : "text-bone/85"
                } ${option.disabled ? "cursor-not-allowed opacity-40" : ""}`}
              >
                <span>{option.label}</span>
                {isSelected && <span className="text-accent">✓</span>}
              </li>
            );
          })}
        </ul>
      )}

      {name && <input type="hidden" name={name} value={current} disabled={disabled} />}
    </div>
  );
}
