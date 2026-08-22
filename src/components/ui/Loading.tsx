'use client';

import { useEffect, useState } from 'react';

/**
 * Loading, in three stages.
 *
 * A spinner that appears for 200ms is a flash, and one that spins for eight
 * seconds says nothing about what is slow. So: nothing at all under 400ms, a
 * skeleton in the shape of the content that is coming, and past three seconds
 * a line naming the operation with a way out.
 */

const SKELETON_AFTER_MS = 400;
const EXPLAIN_AFTER_MS = 3000;

export function useLoadingStage(loading: boolean): 'idle' | 'quiet' | 'skeleton' | 'explain' {
  const [elapsed, setElapsed] = useState<'quiet' | 'skeleton' | 'explain'>('quiet');

  useEffect(() => {
    if (!loading) {
      // Reset on the next tick: resetting during the effect would cascade.
      const reset = setTimeout(() => setElapsed('quiet'), 0);
      return () => clearTimeout(reset);
    }
    const toSkeleton = setTimeout(() => setElapsed('skeleton'), SKELETON_AFTER_MS);
    const toExplain = setTimeout(() => setElapsed('explain'), EXPLAIN_AFTER_MS);
    return () => {
      clearTimeout(toSkeleton);
      clearTimeout(toExplain);
    };
  }, [loading]);

  return loading ? elapsed : 'idle';
}

/** Rows shaped like the list that is loading, so the layout does not jump. */
export function SkeletonRows({ rows = 4, className = '' }: { rows?: number; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className}`} aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 border border-border bg-card px-3.5 py-3">
          <span className="w-1.5 h-1.5 bg-secondary shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-2 bg-secondary" style={{ width: `${52 - i * 6}%` }} />
            <div className="h-1.5 bg-secondary" style={{ width: `${30 - i * 3}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Past three seconds: name what is slow, and offer a way out. */
export function SlowOperation({
  what,
  detail,
  onCancel,
}: {
  what: string;
  detail?: string;
  onCancel?: () => void;
}) {
  const [seconds, setSeconds] = useState(3);

  useEffect(() => {
    const id = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center gap-2.5 border border-border bg-card px-4 py-6 text-center">
      <div className="w-[200px] h-[2px] bg-secondary overflow-hidden">
        <div className="h-full w-1/3 bg-primary animate-[loading-sweep_1.4s_ease-in-out_infinite]" />
      </div>
      <p className="text-xs text-foreground">{what}</p>
      {detail && (
        <p className="text-[10.5px] font-mono text-muted-foreground">
          {detail} · {seconds}s
        </p>
      )}
      {onCancel && (
        <button
          onClick={onCancel}
          className="px-2.5 py-1 text-[11px] border border-border text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      )}
    </div>
  );
}

/** The whole ladder in one component, for the common case. */
export function LoadingState({
  loading,
  rows,
  what,
  detail,
  onCancel,
  children,
}: {
  loading: boolean;
  rows?: number;
  what: string;
  detail?: string;
  onCancel?: () => void;
  children?: React.ReactNode;
}) {
  const stage = useLoadingStage(loading);

  if (!loading) return <>{children}</>;
  if (stage === 'quiet') return null;
  if (stage === 'explain') return <SlowOperation what={what} detail={detail} onCancel={onCancel} />;
  return <SkeletonRows rows={rows} />;
}
