import React, { useState, useEffect, useCallback } from 'react';
import {
  Cpu,
  AlertCircle,
  Loader2,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import type { AgentPersonaValues } from './types';
import type { AgentProvider } from '@/types/electron';
import { PROVIDER_REGISTRY } from '@/lib/providers';
import { ProviderIconRenderer } from '@/components/ProviderBadge';
import AgentPersonaEditor from './AgentPersonaEditor';

interface TasmaniaModel {
  name: string;
  filename: string;
  path: string;
  sizeBytes: number;
  repo: string | null;
  quantization: string | null;
  parameters: string | null;
  architecture: string | null;
}

/** Model definition from provider */
interface ProviderModel {
  id: string;
  name: string;
  description: string;
}

/** Model definitions per provider - derived from shared registry */
const PROVIDER_MODELS: Record<string, ProviderModel[]> = Object.fromEntries(
  PROVIDER_REGISTRY.map((p) => [p.id, p.models]),
);

/** Default model per provider - derived from shared registry */
const PROVIDER_DEFAULT_MODEL: Record<string, string> = Object.fromEntries(
  PROVIDER_REGISTRY.map((p) => [p.id, p.defaultModel]),
);

/* ── Live model catalogue ──────────────────────────────── */

/**
 * Model lists come from the models.dev catalogue in the main process, so a
 * model released today shows up without a release of Tars and without the
 * user having to hold an API key for that provider. The static registry stays
 * as the offline floor.
 */
async function fetchProviderModels(providerId: string): Promise<ProviderModel[] | null> {
  try {
    const res = await window.electronAPI?.models?.list(providerId);
    if (!res?.models?.length) return null;
    return res.models.map(m => ({
      id: m.id,
      name: m.name || m.id,
      description: [
        m.contextWindow ? `${Math.round(m.contextWindow / 1000)}K context` : '',
        m.cost?.input != null ? `$${m.cost.input}/M in` : '',
        m.releaseDate || '',
      ].filter(Boolean).join(' · '),
    }));
  } catch {
    return null;
  }
}

/** CLI binary entry detected from settings */
interface DetectedCli {
  key: string;
  label: string;
  path: string;
}

interface StepModelProps {
  provider: AgentProvider;
  onProviderChange: (provider: AgentProvider) => void;
  model: string;
  onModelChange: (model: string) => void;
  localModel: string;
  onLocalModelChange: (model: string) => void;
  cliPath: string;
  onCliPathChange: (path: string) => void;
  tasmaniaEnabled: boolean;
  installedProviders?: Record<string, boolean>;
  agentPersonaRef: React.MutableRefObject<AgentPersonaValues>;
  projectPath: string;
}

const StepModel = React.memo(function StepModel({
  provider,
  onProviderChange,
  model,
  onModelChange,
  localModel,
  onLocalModelChange,
  cliPath,
  onCliPathChange,
  tasmaniaEnabled,
  installedProviders,
  agentPersonaRef,
  projectPath,
}: StepModelProps) {
  // Dynamic models state
  const [dynamicModels, setDynamicModels] = useState<ProviderModel[] | null>(null);
  const [loadingModels, setLoadingModels] = useState(false);

  // Detected CLIs for the path selector
  const [detectedClis, setDetectedClis] = useState<DetectedCli[]>([]);

  // Tasmania state for local provider
  const [tasmaniaStatus, setTasmaniaStatus] = useState<{
    status: string; modelName: string | null; endpoint: string | null;
  } | null>(null);
  const [tasmaniaModels, setTasmaniaModels] = useState<TasmaniaModel[]>([]);
  const [loadingTasmania, setLoadingTasmania] = useState(false);

  // Detect installed CLIs for the path selector
  useEffect(() => {
    window.electronAPI?.cliPaths?.detect().then((paths) => {
      if (!paths) return;
      const cliMap: { key: string; label: string }[] = [
        { key: 'claude', label: 'Claude' },
        { key: 'codex', label: 'Codex' },
        { key: 'gemini', label: 'Gemini' },
        { key: 'grok', label: 'Grok' },
        { key: 'opencode', label: 'OpenCode' },
        { key: 'pi', label: 'Pi' },
        { key: 'qwencode', label: 'Qwen Code' },
        { key: 'minimax', label: 'MiniMax' },
      ];
      const detected: DetectedCli[] = [];
      for (const { key, label } of cliMap) {
        const p = (paths as Record<string, string>)[key];
        if (p) detected.push({ key, label, path: p });
      }
      setDetectedClis(detected);
    });
  }, []);

  // The catalogue covers every provider, so this runs on each switch.
  const loadDynamicModels = useCallback(async () => {
    setLoadingModels(true);
    const models = await fetchProviderModels(provider);
    setDynamicModels(models);
    setLoadingModels(false);
  }, [provider]);

  useEffect(() => {
    loadDynamicModels();
  }, [loadDynamicModels]);

  // Resolved model list: dynamic if available, else hardcoded fallback
  const resolvedModels = dynamicModels || PROVIDER_MODELS[provider] || PROVIDER_MODELS.claude;

  // Fetch Tasmania status when switching to local provider
  useEffect(() => {
    if (provider !== 'local' || !tasmaniaEnabled) return;
    let cancelled = false;
    setLoadingTasmania(true);

    Promise.all([
      window.electronAPI?.tasmania?.getStatus(),
      window.electronAPI?.tasmania?.getModels(),
    ]).then(([status, modelsResult]) => {
      if (cancelled) return;
      if (status) setTasmaniaStatus(status);
      if (modelsResult?.models) {
        setTasmaniaModels(modelsResult.models);
        if (!localModel && status?.modelName) {
          onLocalModelChange(status.modelName);
        }
      }
    }).finally(() => {
      if (!cancelled) setLoadingTasmania(false);
    });

    return () => { cancelled = true; };
  }, [provider, tasmaniaEnabled]);

  return (
    <div className="space-y-5">
      {/* Section header */}
      <div>
        <h3 className="text-lg font-medium mb-1 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-accent-blue" />
          Choose Model
        </h3>
        <p className="text-text-secondary text-sm">
          Choose the AI provider and model for your agent
        </p>
      </div>

      {/* Provider Selector */}
      <div>
        <label className="block text-sm font-medium mb-2">Provider</label>
        <div className="grid gap-2 grid-cols-4">
          {PROVIDER_REGISTRY.filter((p) => p.id === provider || (p.id !== 'opencode' && p.id !== 'pi' && p.id !== 'local')).map(({ id, label, icon, accent, requiresCli }) => {
            const installed = installedProviders?.[id] === true;
            const disabledReason = !installed
              ? requiresCli ? 'Not installed' : 'Add API key in Settings > AI Providers'
              : null;
            const colorClass = provider === id ? `text-${accent}` : 'text-text-muted';
            return (
              <button
                key={id}
                disabled={!installed}
                onClick={() => {
                  if (!installed) return;
                  onProviderChange(id);
                  onModelChange(PROVIDER_DEFAULT_MODEL[id]);
                }}
                title={disabledReason || undefined}
                className={`
                  p-2.5 rounded-lg border transition-all text-center flex flex-col items-center justify-center gap-1
                  ${!installed
                    ? 'opacity-40 cursor-not-allowed border-border-primary'
                    : provider === id
                      ? `border-${accent} bg-${accent}/10`
                      : 'border-border-primary hover:border-border-accent'
                  }
                `}
              >
                <div className="flex items-center gap-1.5">
                  <ProviderIconRenderer icon={icon} className={`w-4 h-4 ${colorClass}`} />
                  <span className="font-medium text-sm">{label}</span>
                </div>
                {disabledReason && (
                  <span className="text-[10px] text-text-muted">{disabledReason}</span>
                )}
              </button>
            );
          })}
          {tasmaniaEnabled && (
            <button
              onClick={() => onProviderChange('local')}
              className={`
                p-2.5 rounded-lg border transition-all text-center flex items-center justify-center gap-2
                ${provider === 'local'
                  ? 'border-warning bg-warning/10'
                  : 'border-border-primary hover:border-border-accent'
                }
              `}
            >
              <Cpu className={`w-4 h-4 ${provider === 'local' ? 'text-warning' : 'text-text-muted'}`} />
              <span className="font-medium text-sm">Local</span>
            </button>
          )}
        </div>
      </div>

      {/* Model Selection - dynamic dropdown based on provider */}
      {provider !== 'local' ? (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium">Model</label>
            {(
              <button
                onClick={loadDynamicModels}
                disabled={loadingModels}
                className="text-xs text-text-muted hover:text-text-primary flex items-center gap-1 transition-colors"
                title="Refresh from the live model catalogue"
              >
                <RefreshCw className={`w-3 h-3 ${loadingModels ? 'animate-spin' : ''}`} />
                {loadingModels ? 'Loading...' : dynamicModels ? 'Refresh' : 'Fetch models'}
              </button>
            )}
          </div>
          <select
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            className="w-full px-3 py-2 bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-foreground appearance-none"
          >
            {resolvedModels.map((m) => (
              <option key={m.id} value={m.id} title={m.description || undefined}>
                {m.name}
              </option>
            ))}
          </select>
          {dynamicModels && (
            <p className="text-[10px] text-text-muted mt-1">
              {dynamicModels.length} models from API
            </p>
          )}
          {!dynamicModels && model && (
            <p className="text-xs text-text-muted mt-1.5">
              {resolvedModels.find(m => m.id === model)?.description}
            </p>
          )}
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium mb-2">Local Model</label>
          {loadingTasmania ? (
            <div className="p-4 border border-border-primary rounded-lg flex items-center gap-2 text-text-muted">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Connecting to Tasmania...</span>
            </div>
          ) : tasmaniaStatus?.status !== 'running' ? (
            <div className="p-4 border border-warning/30 bg-warning/5 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-warning">Tasmania not running</p>
                  <p className="text-xs text-text-muted mt-1">
                    Start Tasmania and load a model first. Go to Settings &gt; Tasmania to configure.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {tasmaniaStatus.modelName && (
                <div className="p-3 border border-accent-green/30 bg-accent-green/5 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
                    <span className="text-sm font-medium">{tasmaniaStatus.modelName}</span>
                    <span className="text-xs text-text-muted ml-auto">loaded</span>
                  </div>
                </div>
              )}
              {tasmaniaModels.length > 0 && (
                <div>
                  <select
                    value={localModel}
                    onChange={(e) => onLocalModelChange(e.target.value)}
                    className="w-full px-3 py-2 bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-foreground"
                  >
                    {tasmaniaModels.map((m) => (
                      <option key={m.path} value={m.name}>
                        {m.name}{m.quantization ? ` (${m.quantization})` : ''}{m.parameters ? ` - ${m.parameters}` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-text-muted mt-1.5">
                    Select the model to use. The currently loaded model will be used if available.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* CLI Path Override */}
      {detectedClis.length > 0 && (
        <div>
          <label className="block text-sm font-medium mb-2">CLI Binary</label>
          <select
            value={cliPath}
            onChange={(e) => onCliPathChange(e.target.value)}
            className="w-full px-3 py-2 bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-foreground appearance-none"
          >
            <option value="">Default (provider default)</option>
            {detectedClis.map((cli) => (
              <option key={cli.key} value={cli.path}>
                {cli.label} - {cli.path}
              </option>
            ))}
          </select>
          <p className="text-xs text-text-muted mt-1.5">
            Override which CLI binary runs this agent. Defaults to the selected provider&apos;s CLI.
          </p>
        </div>
      )}

      {/* Agent Persona */}
      <AgentPersonaEditor
        projectPath={projectPath}
        onChange={(v) => { agentPersonaRef.current = v; }}
        initialCharacter={agentPersonaRef.current.character}
        initialName={agentPersonaRef.current.name}
      />
    </div>
  );
});

export default StepModel;
