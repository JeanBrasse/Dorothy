'use client';

import { useState } from 'react';
import { Brain, Check, Loader2 } from 'lucide-react';
import { Toggle } from './Toggle';
import type { AppSettings } from './types';

interface MemorySectionProps {
  appSettings: AppSettings;
  onSaveAppSettings: (updates: Partial<AppSettings>) => void;
  onUpdateLocalSettings: (updates: Partial<AppSettings>) => void;
}

interface BackendCardProps {
  title: string;
  description: string;
  docUrl: string;
  enabled: boolean;
  url: string;
  urlPlaceholder: string;
  token: string;
  tokenLabel: string;
  onToggle: (enabled: boolean) => void;
  onSave: (url: string, token: string) => void;
}

function BackendCard({ title, description, docUrl, enabled, url, urlPlaceholder, token, tokenLabel, onToggle, onSave }: BackendCardProps) {
  const [localUrl, setLocalUrl] = useState(url);
  const [localToken, setLocalToken] = useState(token);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const dirty = localUrl !== url || localToken !== token;

  async function handleSave() {
    setSaving(true);
    try {
      onSave(localUrl.trim(), localToken.trim());
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-card border border-border p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {description}{' '}
            <a href={docUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Docs
            </a>
          </p>
        </div>
        <Toggle enabled={enabled} onChange={() => onToggle(!enabled)} />
      </div>

      {enabled && (
        <div className="space-y-2">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">MCP endpoint URL</label>
            <input
              type="text"
              value={localUrl}
              onChange={e => setLocalUrl(e.target.value)}
              placeholder={urlPlaceholder}
              className="w-full px-2 py-1.5 bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40 font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">{tokenLabel}</label>
            <input
              type="password"
              value={localToken}
              onChange={e => setLocalToken(e.target.value)}
              placeholder="Optional - sent as Authorization: Bearer …"
              className="w-full px-2 py-1.5 bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40 font-mono"
            />
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={!dirty || saving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-foreground text-background font-medium hover:bg-foreground/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : saved ? <Check className="w-3 h-3" /> : null}
              {saved ? 'Saved' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export const MemorySection = ({ appSettings, onSaveAppSettings }: MemorySectionProps) => {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          Memory Backends
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Remote memory servers registered as MCP servers in the claude CLI&apos;s user scope.
          Every claude-binary agent shares them - the same brain your Hermes instance and
          claude.ai connectors use. Native CLIs (codex, gemini, grok, opencode, pi) manage
          their own MCP configs and are not covered.
        </p>
      </div>

      <BackendCard
        title="gbrain"
        description="Shared semantic memory (vector + knowledge graph). Point this at your gbrain instance's MCP endpoint."
        docUrl="https://github.com/garrytan/gbrain"
        enabled={!!appSettings.memoryGbrainEnabled}
        url={appSettings.memoryGbrainMcpUrl || ''}
        urlPlaceholder="https://gbrain.example.com/mcp"
        token={appSettings.memoryGbrainAuthToken || ''}
        tokenLabel="Auth token"
        onToggle={enabled => onSaveAppSettings({ memoryGbrainEnabled: enabled })}
        onSave={(url, token) => onSaveAppSettings({ memoryGbrainMcpUrl: url, memoryGbrainAuthToken: token })}
      />

      <BackendCard
        title="Honcho"
        description="Plastic Labs' memory layer (peers, sessions, working representations)."
        docUrl="https://honcho.dev/docs/v3/guides/integrations/mcp"
        enabled={!!appSettings.memoryHonchoEnabled}
        url={appSettings.memoryHonchoMcpUrl || 'https://mcp.honcho.dev'}
        urlPlaceholder="https://mcp.honcho.dev"
        token={appSettings.memoryHonchoApiKey || ''}
        tokenLabel="API key"
        onToggle={enabled => onSaveAppSettings({ memoryHonchoEnabled: enabled })}
        onSave={(url, token) => onSaveAppSettings({ memoryHonchoMcpUrl: url, memoryHonchoApiKey: token })}
      />

      <p className="text-xs text-muted-foreground">
        Changes re-register the servers immediately (equivalent to{' '}
        <code className="bg-secondary px-1">claude mcp add -s user -t http</code>). Running agents
        pick them up on their next session.
      </p>
    </div>
  );
};
