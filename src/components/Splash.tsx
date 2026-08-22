'use client';

import { useEffect, useState } from 'react';
import { BRAND_NAME } from '@/components/Brand';

/**
 * The launch sequence.
 *
 * The window used to appear as a bare shell while the main process detected
 * providers and reached the gateway, which reads as a hang. This says what it
 * is waiting for, in the app's own marks, and gets out of the way the moment
 * the first screen can render.
 */

const STEPS = [
  'reading your projects',
  'detecting providers',
  'connecting to Hermes',
];

export function PromptMark({ size = 44, className = '' }: { size?: number; className?: string }) {
  const stroke = Math.max(2, Math.round(size * 0.16));
  return (
    <svg
      width={size * 1.7}
      height={size}
      viewBox="0 0 76 46"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M 3 3 L 27 21 L 3 39"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="butt"
        strokeLinejoin="miter"
      />
      <rect x="42" y="32" width="26" height={stroke} fill="currentColor" />
    </svg>
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

  const progress = Math.round((step / STEPS.length) * 100);

  return (
    <div
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center gap-5 bg-background transition-opacity duration-250 ${
        leaving ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <PromptMark
        size={44}
        className={`text-primary transition-transform duration-500 ${step > 0 ? 'scale-100' : 'scale-90'}`}
      />

      <span
        className={`font-serif text-4xl text-foreground transition-opacity duration-500 ${
          step > 0 ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {BRAND_NAME}
      </span>

      <div className="w-[220px] h-[2px] bg-secondary">
        <div
          className="h-full bg-primary transition-[width] duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

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
