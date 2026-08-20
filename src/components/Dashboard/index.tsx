'use client';

import { Loader2 } from 'lucide-react';
import { useClaude } from '@/hooks/useClaude';
import dynamic from 'next/dynamic';

// Dynamically import TerminalsView to avoid SSR issues with xterm
const TerminalsView = dynamic(() => import('@/components/TerminalsView'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full min-h-[600px] bg-card border border-border">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">Loading Terminals...</p>
      </div>
    </div>
  ),
});

export default function Dashboard() {
  const { data } = useClaude();
  const activeSessions = data?.activeSessions || [];

  return (
    <div className="space-y-4 pt-4 lg:pt-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-xs lg:text-sm mt-1 hidden sm:block">
            Monitor your AI Agents in real-time
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground hidden sm:block">
          <div className="flex items-center gap-2 justify-end">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span>{activeSessions.length} active session{activeSessions.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="mt-0.5">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </div>
        </div>
      </div>

      {/* Terminals */}
      <div
        className="border border-border bg-card overflow-hidden"
        style={{ height: 'calc(100vh - 130px)', minHeight: '400px' }}
      >
        <TerminalsView />
      </div>
    </div>
  );
}
