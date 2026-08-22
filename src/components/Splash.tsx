'use client';

import { useEffect, useState } from 'react';
import { BRAND_NAME } from '@/components/Brand';

/**
 * The launch sequence.
 *
 * The window used to appear as a bare shell while the main process detected
 * providers and reached the gateway, which reads as a hang. This says what it
 * is waiting for, in the app's own mark: the orange square, drawn as a grid
 * that fills itself in as each step lands.
 */

const STEPS = [
  'reading your projects',
  'detecting providers',
  'connecting to Hermes',
];

const GRID = 4;
const CELLS = GRID * GRID;

/**
 * The mark, assembling. `filled` cells are lit; the rest sit at the dim rest
 * state so the square keeps its silhouette the whole way through.
 */
export function SquareGrid({
  filled,
  size = 56,
  className = '',
}: {
  filled: number;
  size?: number;
  className?: string;
}) {
  const gap = Math.max(2, Math.round(size * 0.07));
  const cell = (size - gap * (GRID - 1)) / GRID;

  return (
    <div
      className={`grid ${className}`}
      style={{
        width: size,
        height: size,
        gap,
        gridTemplateColumns: `repeat(${GRID}, ${cell}px)`,
      }}
      aria-hidden
    >
      {Array.from({ length: CELLS }).map((_, i) => (
        <span
          key={i}
          className="bg-primary transition-opacity duration-300 ease-out"
          style={{ opacity: i < filled ? 1 : 0.16 }}
        />
      ))}
    </div>
  );
}

/** The same mark, waiting rather than progressing: a row of squares in turn. */
export function SquarePulse({ count = 5, size = 6 }: { count?: number; size?: number }) {
  return (
    <div className="flex" style={{ gap: size }} aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className="bg-primary"
          style={{
            width: size,
            height: size,
            animation: `square-pulse 1.2s ease-in-out ${i * 0.12}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

export function Splash({ onDone }: { onDone?: () => void }) {
  const [step, setStep] = useState(0);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const timers = STEPS.map((_, i) =>
      setTimeout(() => setStep(i + 1), 220 + i * 260),
    );

    const finish = setTimeout(() => {
      setLeaving(true);
      setTimeout(() => onDone?.(), 260);
    }, 220 + STEPS.length * 260);

    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(finish);
    };
  }, [onDone]);

  // The grid fills in step with the work, not on a timer of its own.
  const filled = Math.round((step / STEPS.length) * CELLS);

  return (
    <div
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center gap-6 bg-background transition-opacity duration-250 ${
        leaving ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <SquareGrid filled={filled} size={56} />

      <span
        className={`font-serif text-4xl text-foreground transition-opacity duration-500 ${
          step > 0 ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {BRAND_NAME}
      </span>

      <span
        className={`font-mono text-[11px] text-muted-foreground transition-opacity duration-300 ${
          step > 0 ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {STEPS[Math.min(step, STEPS.length - 1)]}
      </span>
    </div>
  );
}
