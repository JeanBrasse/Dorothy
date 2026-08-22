'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, Eye, EyeOff, Loader2, Play, RefreshCw, Send } from 'lucide-react';
import type { AppSettings, } from './types';
import type { HermesConnection, HermesMode } from '@/types/electron';

const MODES: { id: HermesMode; label: string; hint: string }[] = [
  { id: 'local', label: 'Local', hint: 'Hermes runs on this machine' },
  { id: 'ssh', label: 'SSH', hint: 'Tunnel to a box over SSH' },
  { id: 'remote', label: 'Remote gateway', hint: 'Reach a gateway by URL (Tailscale, LAN…)' },
  { id: 'cloud', label: 'Hermes cloud', hint: 'Hosted gateway with an org' },
];

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

  const [conn, setConn] = useState<HermesConnection>({ mode: 'local', localPort: 9119, authMode: 'token' });
  const [savedConn, setSavedConn] = useState<string>('');
  const [desktopAvailable, setDesktopAvailable] = useState(false);
  const [gatewayTesting, setGatewayTesting] = useState(false);
  const [gatewayResult, setGatewayResult] = useState<{ success: boolean; message: string } | null>(null);
  const connDirty = JSON.stringify(conn) !== savedConn;
  const inputCls = "w-full px-2 py-1.5 bg-secondary border border-border text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40 font-mono";


  useEffect(() => {
    window.electronAPI?.hermes?.getConnection().then(r => {
      if (!r) return;
      setConn(r.connection);
      setSavedConn(JSON.stringify(r.connection));
      setDesktopAvailable(r.desktopConfigAvailable);
    });
  }, []);

  function patchConn(patch: Partial<HermesConnection>) {
    setConn(prev => ({ ...prev, ...patch }));
    setGatewayResult(null);
  }
  function patchSsh(patch: Partial<NonNullable<HermesConnection['ssh']>>) {
    setConn(prev => ({ ...prev, ssh: { host: '', user: '', ...prev.ssh, ...patch } }));
    setGatewayResult(null);
  }

  async function handleImportDesktop() {
    const r = await window.electronAPI?.hermes?.importDesktopConnection();
    if (r?.success && r.connection) {
      setConn(r.connection);
      setSavedConn(JSON.stringify(r.connection));
      setGatewayResult({ success: true, message: `Imported from Hermes Desktop — ${r.baseUrl}` });
    } else {
      setGatewayResult({ success: false, message: r?.error || 'Import failed' });
    }
  }

  async function handleSaveConn() {
    const r = await window.electronAPI?.hermes?.saveConnection(conn);
    if (r?.success) setSavedConn(JSON.stringify(conn));
    else setGatewayResult({ success: false, message: r?.error || 'Save failed' });
  }

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
      const r = await window.electronAPI?.hermes?.testConnection(conn);
      if (!r) { setGatewayResult({ success: false, message: 'Electron API unavailable' }); return; }
      if (!r.success) {
        setGatewayResult({ success: false, message: `${r.baseUrl || ''} — ${r.error || `HTTP ${r.status}`}` });
        return;
      }
      const bits = [`Hermes ${r.version ?? '?'}`];
      if (r.gatewayState) bits.push(r.gatewayState);
      if (r.needsSignIn) {
        bits.push(`sign-in required (${(r.authProviders || []).join(', ') || 'cookie'}) — a static token will not authenticate this gateway`);
      } else if (r.authRequired) {
        bits.push('auth required');
      } else {
        bits.push('open');
      }
      setGatewayResult({ success: !r.needsSignIn, message: `${r.baseUrl} · ${bits.join(' · ')}` });
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

      {/* ── Hermes instance (Dorothy → Hermes) ── */}
      <div className="bg-card border border-border p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Hermes instance — Dorothy → Hermes</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Same connection modes as Hermes Desktop. Dorothy probes <code className="bg-secondary px-1">/api/status</code> to
              report the version and which sign-in the gateway demands.
            </p>
          </div>
          {desktopAvailable && (
            <button
              onClick={handleImportDesktop}
              className="shrink-0 px-2.5 py-1.5 text-xs border border-border bg-card text-foreground hover:bg-accent/50 transition-colors"
              title="Reuse the connection configured in Hermes Desktop"
            >
              Import from Desktop
            </button>
          )}
        </div>

        {/* Mode selector */}
        <div className="grid grid-cols-4 gap-1">
          {MODES.map(m => (
            <button
              key={m.id}
              onClick={() => patchConn({ mode: m.id })}
              title={m.hint}
              className={`px-2 py-1.5 text-xs border transition-colors ${
                conn.mode === m.id
                  ? 'bg-primary/10 border-primary text-foreground'
                  : 'bg-secondary border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground -mt-1">
          {MODES.find(m => m.id === conn.mode)?.hint}
        </p>

        {/* Per-mode fields */}
        {conn.mode === 'local' && (
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Gateway port</label>
            <input
              type="number"
              value={conn.localPort ?? 9119}
              onChange={e => patchConn({ localPort: Number(e.target.value) || 9119 })}
              className={inputCls}
            />
          </div>
        )}

        {conn.mode === 'ssh' && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs font-medium text-foreground mb-1">Host</label>
                <input type="text" value={conn.ssh?.host || ''} onChange={e => patchSsh({ host: e.target.value })} placeholder="vps.example.com" className={inputCls} />
              </div>
              <div className="w-32">
                <label className="block text-xs font-medium text-foreground mb-1">User</label>
                <input type="text" value={conn.ssh?.user || ''} onChange={e => patchSsh({ user: e.target.value })} placeholder="root" className={inputCls} />
              </div>
              <div className="w-24">
                <label className="block text-xs font-medium text-foreground mb-1">SSH port</label>
                <input type="number" value={conn.ssh?.port ?? 22} onChange={e => patchSsh({ port: Number(e.target.value) || 22 })} className={inputCls} />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs font-medium text-foreground mb-1">Private key (optional)</label>
                <input type="text" value={conn.ssh?.keyPath || ''} onChange={e => patchSsh({ keyPath: e.target.value })} placeholder="~/.ssh/id_ed25519" className={inputCls} />
              </div>
              <div className="w-32">
                <label className="block text-xs font-medium text-foreground mb-1">Remote port</label>
                <input type="number" value={conn.ssh?.remotePort ?? 9119} onChange={e => patchSsh({ remotePort: Number(e.target.value) || 9119 })} className={inputCls} />
              </div>
              <div className="w-32">
                <label className="block text-xs font-medium text-foreground mb-1">Local port</label>
                <input type="number" value={conn.ssh?.localPort ?? conn.ssh?.remotePort ?? 9119} onChange={e => patchSsh({ localPort: Number(e.target.value) || undefined })} className={inputCls} />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Dorothy reads the gateway through the tunnel on 127.0.0.1 — open it with your usual
              <code className="bg-secondary px-1 mx-1">ssh -L</code> command or the Hermes Desktop tunnel.
            </p>
          </div>
        )}

        {(conn.mode === 'remote' || conn.mode === 'cloud') && (
          <div className="space-y-2">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Gateway URL</label>
              <input
                type="text"
                value={conn.url || ''}
                onChange={e => patchConn({ url: e.target.value })}
                placeholder={conn.mode === 'cloud' ? 'https://gateway.hermes.cloud' : 'http://100.x.y.z:9119'}
                className={inputCls}
              />
            </div>
            {conn.mode === 'cloud' && (
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Organisation</label>
                <input type="text" value={conn.org || ''} onChange={e => patchConn({ org: e.target.value })} placeholder="my-org" className={inputCls} />
              </div>
            )}
            <div className="flex gap-2">
              <div className="w-40">
                <label className="block text-xs font-medium text-foreground mb-1">Auth</label>
                <select
                  value={conn.authMode || 'token'}
                  onChange={e => patchConn({ authMode: e.target.value as 'token' | 'oauth' })}
                  className="w-full px-2 py-1.5 bg-secondary border border-border text-xs text-foreground outline-none focus:border-primary/40"
                >
                  <option value="token">Session token</option>
                  <option value="oauth">OAuth / sign-in</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-foreground mb-1">Token</label>
                <input type="password" value={conn.token || ''} onChange={e => patchConn({ token: e.target.value })} placeholder="X-Hermes-Session-Token" className={inputCls} />
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            onClick={handleTestGateway}
            disabled={gatewayTesting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border bg-card text-foreground hover:bg-accent/50 disabled:opacity-40"
          >
            {gatewayTesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
            Test connection
          </button>
          <button
            onClick={handleSaveConn}
            disabled={!connDirty}
            className="px-3 py-1.5 text-xs bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-40"
          >
            Save
          </button>
        </div>
        {gatewayResult && (
          <p className={`text-xs px-2 py-1.5 border font-mono ${gatewayResult.success
            ? 'text-success bg-success/10 border-success/30'
            : 'text-danger bg-danger/10 border-danger/30'}`}>
            {gatewayResult.message}
          </p>
        )}
      </div>
    </div>
  );
};
