'use client';

import type { ReactNode } from 'react';

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const TONES: Record<Tone, string> = {
  success: 'bg-success/10 text-success border-success/25',
  warning: 'bg-warning/10 text-warning border-warning/25',
  danger: 'bg-danger/10 text-danger border-danger/25',
  info: 'bg-primary/10 text-primary border-primary/25',
  neutral: 'bg-secondary text-muted-foreground border-border',
};

/** Every success/error/warning pill in the app — one tone table, no raw colors. */
export function StatusBadge({ tone = 'neutral', children, className = '' }: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs border ${TONES[tone]} ${className}`}>
      {children}
    </span>
  );
}

/** Small state dot — the only place a fully-round shape is legitimate. */
export function StatusDot({ tone = 'neutral', className = '' }: { tone?: Tone; className?: string }) {
  const color = tone === 'success' ? 'bg-success'
    : tone === 'warning' ? 'bg-warning'
    : tone === 'danger' ? 'bg-danger'
    : tone === 'info' ? 'bg-primary'
    : 'bg-muted-foreground';
  return <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${color} ${className}`} />;
}
