'use client';

/**
 * The single source of the app's identity - mark + wordmark.
 * Rebranding the app = editing this file (and the OS-level icon), nothing else.
 */

export const BRAND_NAME = 'Tars';

export function BrandMark({ className = 'w-2.5 h-2.5' }: { className?: string }) {
  return <span className={`inline-block bg-primary shrink-0 ${className}`} aria-hidden />;
}

export function Brand({ showWordmark = true, markClassName = 'w-2.5 h-2.5', wordmarkClassName = 'font-serif text-lg text-foreground' }: {
  showWordmark?: boolean;
  markClassName?: string;
  wordmarkClassName?: string;
}) {
  return (
    <span className="flex items-center gap-2.5 min-w-0">
      <BrandMark className={markClassName} />
      {showWordmark && <span className={`truncate ${wordmarkClassName}`}>{BRAND_NAME}</span>}
    </span>
  );
}
