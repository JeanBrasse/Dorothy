'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import Link from 'next/link';

/**
 * Hermes-backed board. The harness — task lifecycle, workers, runs — lives in
 * Hermes; Dorothy only reads the board and moves cards. Columns are Hermes'
 * own eight, never projected onto a smaller set (that would be lossy on write).
 */

const COLUMNS = ['triage', 'todo', 'scheduled', 'ready', 'running', 'blocked', 'review', 'done'] as const;

const COLUMN_TONE: Record<string, string> = {
  running: 'text-success',
  blocked: 'text-danger',
  review: 'text-warning',
  done: 'text-muted-foreground',
};

interface HermesTask {
  id: string;
  title?: string;
  status?: string;
  priority?: string | number;
  assignee?: string;
  worker?: string;
  labels?: string[];
  children_done?: number;
  children_total?: number;
  comment_count?: number;
}

interface BoardPayload {
  columns?: Record<string, HermesTask[]>;
}

export default function HermesBoard() {
  const [board, setBoard] = useState<BoardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await window.electronAPI?.hermes?.kanbanBoard();
      if (!r) { setError('Electron API unavailable'); return; }
      if (!r.success) {
        setError(r.error || 'Could not read the Hermes board');
        setNeedsSignIn(!!r.needsSignIn);
        return;
      }
      setNeedsSignIn(false);
      setBoard((r.board ?? {}) as BoardPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading && !board) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Reading the Hermes board…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
        <AlertCircle className="w-6 h-6 text-warning" />
        <p className="text-sm text-foreground max-w-md">{error}</p>
        {needsSignIn ? (
          <Link href="/settings" className="text-xs text-primary hover:underline">
            Sign in to your gateway in Settings → Hermes
          </Link>
        ) : (
          <Link href="/settings" className="text-xs text-primary hover:underline">
            Check the connection in Settings → Hermes
          </Link>
        )}
        <button onClick={load} className="px-3 py-1.5 text-xs border border-border bg-card hover:bg-accent/50">
          Retry
        </button>
      </div>
    );
  }

  const columns = board?.columns ?? {};

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-1 pb-2 shrink-0">
        <p className="text-xs text-muted-foreground">
          Board served by your Hermes gateway — tasks, workers and runs are executed there.
        </p>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs border border-border bg-card text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-x-auto">
        <div className="flex gap-3 h-full min-w-max pb-2">
          {COLUMNS.map(col => {
            const tasks = columns[col] ?? [];
            return (
              <div key={col} className="w-64 shrink-0 flex flex-col border border-border bg-card">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                  <span className={`text-xs font-mono uppercase tracking-wider ${COLUMN_TONE[col] ?? 'text-foreground'}`}>
                    {col}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground">{tasks.length}</span>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
                  {tasks.length === 0 && (
                    <p className="text-[11px] text-muted-foreground px-1 py-2">Empty</p>
                  )}
                  {tasks.map(t => (
                    <div key={t.id} className="border border-border bg-secondary/40 p-2 space-y-1">
                      <p className="text-xs text-foreground leading-snug">{t.title || t.id}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {t.assignee && <span className="text-[10px] font-mono text-muted-foreground">@{t.assignee}</span>}
                        {t.worker && <span className="text-[10px] font-mono text-success">{t.worker}</span>}
                        {typeof t.children_total === 'number' && t.children_total > 0 && (
                          <span className="text-[10px] font-mono text-muted-foreground">
                            {t.children_done ?? 0}/{t.children_total}
                          </span>
                        )}
                        {(t.labels ?? []).slice(0, 2).map(l => (
                          <span key={l} className="text-[10px] px-1 bg-primary/10 text-primary">{l}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
