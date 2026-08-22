'use client';

import { useState } from 'react';
import { Package, Puzzle } from 'lucide-react';
import SkillsTab from '@/components/Extensions/SkillsTab';
import PluginsTab from '@/components/Extensions/PluginsTab';

const TABS = [
  { id: 'skills', label: 'Skills', icon: Package },
  { id: 'plugins', label: 'Plugins', icon: Puzzle },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function ExtensionsPage() {
  const [tab, setTab] = useState<TabId>('skills');

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] lg:h-[calc(100vh-3rem)] pt-4 lg:pt-6 overflow-hidden">
      {/* Header + tab switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3 shrink-0">
        <h1 className="text-xl lg:text-2xl font-bold tracking-tight">Extensions</h1>
        <div className="flex items-center gap-0.5 border border-border bg-card p-0.5">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                tab === id
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Active tab - only the selected one mounts, so the inactive tab's
          marketplace fetch doesn't run until it's opened */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === 'skills' ? <SkillsTab /> : <PluginsTab />}
      </div>
    </div>
  );
}
