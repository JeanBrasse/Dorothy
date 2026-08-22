'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface DropdownOption<T extends string = string> {
  value: T;
  label: string;
  hint?: string;
  disabled?: boolean;
}

/**
 * Themed replacement for <select>. Native selects render their popup through
 * the OS, so they ignore the app's palette entirely: every model/provider
 * picker looked like a stock macOS menu. This renders the list ourselves.
 */
export function Dropdown<T extends string = string>({
  value,
  options,
  onChange,
  placeholder = 'Select…',
  className = '',
  align = 'left',
  mono = false,
}: {
  value: T | '';
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  className?: string;
  align?: 'left' | 'right';
  mono?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = options.find(o => o.value === value);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 bg-secondary border border-border text-xs text-foreground hover:border-border-accent transition-colors ${mono ? 'font-mono' : ''}`}
      >
        <span className={`truncate ${current ? '' : 'text-muted-foreground'}`}>
          {current?.label ?? placeholder}
        </span>
        <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
      </button>

      {open && (
        <div
          className={`absolute z-[90] mt-1 min-w-full max-h-64 overflow-y-auto bg-card border border-border ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
          {options.map(o => (
            <button
              key={o.value}
              type="button"
              disabled={o.disabled}
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={`w-full flex items-start gap-2 px-2.5 py-1.5 text-left text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                o.value === value ? 'bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-primary/5 hover:text-foreground'
              }`}
            >
              <Check className={`w-3 h-3 mt-0.5 shrink-0 ${o.value === value ? 'text-primary' : 'opacity-0'}`} />
              <span className="min-w-0">
                <span className={`block truncate ${mono ? 'font-mono' : ''}`}>{o.label}</span>
                {o.hint && <span className="block text-[10px] text-muted-foreground truncate">{o.hint}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
