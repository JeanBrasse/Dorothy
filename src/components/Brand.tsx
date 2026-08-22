'use client';

/**
 * The single source of the app's identity - mark + wordmark.
 * Rebranding the app = editing this file (and the OS-level icon), nothing else.
 */

export const BRAND_NAME = 'Tars';

export function BrandMark({ className = 'w-2.5 h-2.5' }: { className?: string }) {
  return <span className={`inline-block bg-primary shrink-0 ${className}`} aria-hidden />;
}

export function Brand({
  showWordmark = true,
  markClassName = 'w-2.5 h-2.5',
  wordmarkClassName = 'font-serif text-lg text-foreground',
  markSlotClassName,
  gapClassName = 'gap-2.5',
}: {
  showWordmark?: boolean;
  markClassName?: string;
  wordmarkClassName?: string;
  /** Give the mark a fixed slot so it lines up with a column of icons below it. */
  markSlotClassName?: string;
  gapClassName?: string;
}) {
  const mark = <BrandMark className={markClassName} />;
  return (
    <span className={`flex items-center ${gapClassName} min-w-0`}>
      {markSlotClassName ? (
        <span className={`flex items-center shrink-0 ${markSlotClassName}`}>{mark}</span>
      ) : (
        mark
      )}
      {showWordmark && <span className={`truncate ${wordmarkClassName}`}>{BRAND_NAME}</span>}
    </span>
  );
}
