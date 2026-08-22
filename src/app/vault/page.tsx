'use client';

import VaultView from '@/components/VaultView';

export default function VaultPage() {
  return (
    <div className="h-[calc(100vh-7rem)] lg:h-[calc(100vh-3rem)] flex flex-col pt-4 lg:pt-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 lg:mb-6">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-foreground">Vault</h1>
          <p className="text-muted-foreground text-xs lg:text-sm mt-1 hidden sm:block">
            Agent reports and working documents. Long-term memory lives in Brain.
          </p>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <VaultView embedded />
      </div>
    </div>
  );
}
