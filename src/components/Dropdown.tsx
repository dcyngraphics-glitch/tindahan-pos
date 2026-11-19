import { useEffect, useRef, useState } from 'react';

export interface DropdownOption<T extends string> {
  value: T;
  label: string;
}

interface DropdownProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: DropdownOption<T>[];
  /** Names the control for screen readers and for the visible fallback text. */
  ariaLabel: string;
  className?: string;
}

/**
 * A touch-first replacement for the native `<select>`.
 *
 * iPadOS Safari has a long-standing bug where the native option popup stops
 * appearing after the app has been backgrounded and reopened — Apple acknowledged
 * it and only fixed it in iPadOS 16.2, and it still reproduces on older iPads.
 * A `<select>` is also a poor touch target. This control is ordinary buttons, so
 * it behaves the same everywhere.
 */
export function Dropdown<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className = '',
}: DropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const active = options.find(o => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen(o => !o)}
        className={`flex items-center justify-between gap-2 min-h-[44px] px-3 py-1 border border-slate-200 rounded-xl bg-white font-medium text-slate-800 ${className}`}
      >
        <span className="truncate">{active?.label ?? value}</span>
        <span aria-hidden="true" className="text-slate-400 shrink-0">▾</span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className="absolute left-0 z-30 mt-1 w-max min-w-full max-w-[17rem] py-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-y-auto"
        >
          {options.map(option => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`w-full text-left px-3 min-h-[44px] text-sm font-medium transition-colors ${
                option.value === value
                  ? 'bg-amber-50 text-amber-800'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
