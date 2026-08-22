'use client';

import { useEffect, useState } from 'react';
import KanbanBoard from '@/components/KanbanBoard';
import HermesBoard from '@/components/KanbanBoard/HermesBoard';

type Source = 'hermes' | 'local';

const SOURCE_KEY = 'dorothy-kanban-source';

export default function KanbanPage() {
  // Hermes owns the task harness, so it is the default board; the local board
  // stays available for projects that aren't driven by a gateway.
  const [source, setSource] = useState<Source>('hermes');

  useEffect(() => {
    const saved = localStorage.getItem(SOURCE_KEY);
    if (saved === 'local' || saved === 'hermes') setSource(saved);
  }, []);

  function pick(next: Source) {
    setSource(next);
    localStorage.setItem(SOURCE_KEY, next);
  }

  return (
    <div className="h-[calc(100vh-7rem)] lg:h-[calc(100vh-3rem)] flex flex-col pt-4 lg:pt-6">
      <div className="flex items-center justify-between gap-3 mb-3 shrink-0">
        <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-foreground">Kanban</h1>
        <div className="flex items-center border border-border bg-card">
          {(['hermes', 'local'] as Source[]).map(s => (
            <button
              key={s}
              onClick={() => pick(s)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                source === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {s === 'hermes' ? 'Hermes' : 'Local'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {source === 'hermes' ? <HermesBoard /> : <KanbanBoard />}
      </div>
    </div>
  );
}
