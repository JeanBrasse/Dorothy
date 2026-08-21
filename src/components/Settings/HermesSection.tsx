'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, Eye, EyeOff, Loader2, Play, RefreshCw, Send } from 'lucide-react';
import type { AppSettings } from './types';

interface HermesSectionProps {
  appSettings: AppSettings;
  onSaveAppSettings: (updates: Partial<AppSettings>) => void;
  onUpdateLocalSettings: (updates: Partial<AppSettings>) => void;
}

interface ConnectionInfo {
  apiPort: number;
  webhookPath: string;
  webhookLocalUrl: string;
  webhookTailnetUrl?: string;
  apiToken: string;
  tailscale: { installed: boolean; running: boolean; dnsName?: string; ip?: string; serveConfigured: boolean };
  serveCommand: string;
}

function CopyField({ label, value, secret = false }: { label: string; value: string; secret?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(!secret);

  return (
    <div>
      <label className="block text-xs font-medium text-foreground mb-1">{label}</label>
      <div className="flex items-center gap-1.5">
        <code className="flex-1 px-2 py-1.5 bg-secondary border border-border text-xs text-foreground font-mono truncate">
          {revealed ? value : '•'.repeat(Math.min(value.length, 32))}
        </code>
        {secret && (
          <button
            onClick={() => setRevealed(r => !r)}
            className="p-1.5 border border-border text-muted-foreground hover:text-foreground"
            title={revealed ? 'Hide' : 'Reveal'}
          >
            {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        )}
        <button
          onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          className="p-1.5 border border-border text-muted-foreground hover:text-foreground"
          title="Copy"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}

export const HermesSection = ({ appSettings, onSaveAppSettings }: HermesSectionProps) => {
  const [info, setInfo] = useState<ConnectionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const [testAgentName, setTestAgentName] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [gatewayUrl, setGatewayUrl] = useState(appSettings.hermesGatewayUrl || '');
  const [gatewayToken, setGatewayToken] = useState(appSettings.hermesGatewayToken || '');
  const [gatewayTesting, setGatewayTesting] = useState(false);
  const [gatewayResult, setGatewayResult] = useState<{ success: boolean; message: string } | null>(null);
  const gatewayDirty = gatewayUrl !== (appSettings.hermesGatewayUrl || '') || gatewayToken !== (appSettings.hermesGatewayToken || '');

  const refreshInfo = () => {
    setLoading(true);
    window.electronAPI?.hermes?.getConnectionInfo()
      .then(i => setInfo(i))
      .finally(() => setLoading(false));
  };

  useEffect(refreshInfo, []);

  async function handleTestWebhook() {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await window.electronAPI?.hermes?.testWebhook({ agentName: testAgentName.trim() || undefined });
      if (!result) {
        setTestResult({ success: false, message: 'Electron API unavailable' });
      } else if (result.success) {
        const agent = (result.response as { agent?: { name?: string; projectPath?: string } })?.agent;
        setTestResult({ success: true, message: `OK — auth accepted, agent resolved: ${agent?.name ?? '?'} (${agent?.projectPath ?? '?'})` });
      } else {
        const err = (result.response as { error?: string })?.error || result.error || `HTTP ${result.status}`;
        setTestResult({ success: false, message: err });
      }
    } finally {
      setTesting(false);
    }
  }

  async function handleTestGateway() {
    setGatewayTesting(true);
    setGatewayResult(null);
    try {
      const result = await window.electronAPI?.hermes?.testGateway(gatewayUrl);
      if (result?.success) {
        setGatewayResult({ success: true, message: `Reachable (HTTP ${result.status})` });
      } else {
        setGatewayResult({ success: false, message: result?.error || 'Unreachable' });
      }
    } finally {
      setGatewayTesting(false);
    }
  }

  const webhookUrl = info?.tailscale.serveConfigured && info.webhookTailnetUrl
    ? info.webhookTailnetUrl
    : info?.webhookTailnetUrl ?? info?.webhookLocalUrl ?? '';

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Send className="w-5 h-5 text-primary" />
          Hermes
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Wire your self-hosted Hermes instance to Dorothy. Hermes owns all scheduling —
          its cron jobs call the webhook below to drive your agents.
        </p>
      </div>

      {/* ── Incoming webhook (Hermes → Dorothy) ── */}
      <div className="bg-card border border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Incoming webhook — Hermes → Dorothy</h3>
          <button onClick={refreshInfo} className="p-1.5 text-muted-foreground hover:text-foreground" title="Refresh">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loading || !info ? (
          <div className="flex items-center gap-2 text-muted-foreground text-xs py-4">
            <Loader2 className="w-4 h-4 animate-spin" /> Detecting Tailscale…
          </div>
        ) : (
          <>
            {/* Tailscale state */}
            <div className="text-xs space-y-1">
              <p className="text-muted-foreground">
                Tailscale:{' '}
                {info.tailscale.running ? (
                  <span className="text-green-600">running{info.tailscale.dnsName ? ` — ${info.tailscale.dnsName}` : ''}</span>
                ) : info.tailscale.installed ? (
                  <span className="text-amber-600">installed but not running</span>
                ) : (
                  <span className="text-destructive">not found — the VPS needs a tunnel to reach this machine</span>
                )}
              </p>
              {info.tailscale.running && !info.tailscale.serveConfigured && (
                <p className="text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-1.5">
                  The API only listens on localhost. Expose it to your tailnet once with:{' '}
                  <code className="bg-secondary px-1 font-mono">{info.serveCommand}</code>
                </p>
              )}
              {info.tailscale.serveConfigured && (
                <p className="text-green-600">tailscale serve is active — the VPS can reach the webhook.</p>
              )}
            </div>

            <CopyField label="Webhook URL (use from your VPS)" value={webhookUrl} />
            <CopyField label="Bearer token (Authorization header)" value={info.apiToken} secret />

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Example Hermes cron payload</label>
              <pre className="px-2 py-1.5 bg-secondary border border-border text-[11px] text-foreground font-mono overflow-x-auto">
{`curl -X POST ${webhookUrl} \\
  -H "Authorization: Bearer <token>" \\
  -H "Content-Type: application/json" \\
  -d '{"agent_name": "QA — myproject", "message": "Run the test suite and report"}'`}
              </pre>
            </div>

            {/* Dry-run test */}
            <div className="border-t border-border pt-3">
              <label className="block text-xs font-medium text-foreground mb-1">
                Test the webhook (dry run — resolves the agent, dispatches nothing)
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={testAgentName}
                  onChange={e => setTestAgentName(e.target.value)}
                  placeholder="Agent name (exact, case-insensitive)"
                  className="flex-1 px-2 py-1.5 bg-secondary border border-border text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40"
                />
                <button
                  onClick={handleTestWebhook}
                  disabled={testing || !testAgentName.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-foreground text-background font-medium hover:bg-foreground/90 disabled:opacity-40"
                >
                  {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                  Test
                </button>
              </div>
              {testResult && (
                <p className={`text-xs mt-1.5 px-2 py-1.5 border ${testResult.success
                  ? 'text-green-700 dark:text-green-400 bg-green-500/10 border-green-500/30'
                  : 'text-destructive bg-destructive/10 border-destructive/30'}`}>
                  {testResult.message}
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Hermes gateway (Dorothy → Hermes) ── */}
      <div className="bg-card border border-border p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Hermes instance — Dorothy → Hermes</h3>
        <p className="text-xs text-muted-foreground">
          Your Hermes gateway URL on the tailnet (used for reachability checks now; cron
          control from Dorothy will build on it).
        </p>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Gateway URL</label>
          <input
            type="text"
            value={gatewayUrl}
            onChange={e => setGatewayUrl(e.target.value)}
            placeholder="http://<vps-tailnet-name>:PORT"
            className="w-full px-2 py-1.5 bg-secondary border border-border text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40 font-mono"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Gateway token (optional)</label>
          <input
            type="password"
            value={gatewayToken}
            onChange={e => setGatewayToken(e.target.value)}
            placeholder="Sent as Authorization: Bearer …"
            className="w-full px-2 py-1.5 bg-secondary border border-border text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40 font-mono"
          />
        </div>
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={handleTestGateway}
            disabled={gatewayTesting || !gatewayUrl.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border bg-card text-foreground hover:bg-accent/50 disabled:opacity-40"
          >
            {gatewayTesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
            Test reachability
          </button>
          <button
            onClick={() => onSaveAppSettings({ hermesGatewayUrl: gatewayUrl.trim(), hermesGatewayToken: gatewayToken.trim() })}
            disabled={!gatewayDirty}
            className="px-3 py-1.5 text-xs bg-foreground text-background font-medium hover:bg-foreground/90 disabled:opacity-40"
          >
            Save
          </button>
        </div>
        {gatewayResult && (
          <p className={`text-xs px-2 py-1.5 border ${gatewayResult.success
            ? 'text-green-700 dark:text-green-400 bg-green-500/10 border-green-500/30'
            : 'text-destructive bg-destructive/10 border-destructive/30'}`}>
            {gatewayResult.message}
          </p>
        )}
      </div>
    </div>
  );
};
