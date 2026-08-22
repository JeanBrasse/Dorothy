import * as fs from 'fs';
import * as path from 'path';
import { DATA_DIR } from '../../constants';
import type { AgentProvider } from '../../types';

/**
 * Which CLIs can be driven over the Agent Client Protocol, and how to launch
 * them.
 *
 * ACP is what makes orchestration provider-agnostic: the same JSON-RPC
 * conversation drives Claude Code, Codex, Gemini, Grok, opencode and the rest,
 * and a turn *returns* with a stop reason and its token usage instead of
 * leaving us to guess from terminal output.
 *
 * The public registry publishes one agent.json per agent with the exact
 * distribution to run, so the launch commands are not hardcoded knowledge that
 * rots - they are refreshed like the model catalogue.
 */

const REGISTRY_BASE = 'https://raw.githubusercontent.com/agentclientprotocol/registry/main';
const CACHE_FILE = path.join(DATA_DIR, 'acp-registry.json');
const TTL_MS = 24 * 60 * 60 * 1000;

export interface AcpAgentEntry {
  id: string;
  name: string;
  version: string;
  command: string;
  args: string[];
}

/** Tars provider id to registry agent id. */
const PROVIDER_TO_ACP: Partial<Record<AgentProvider, string>> = {
  claude: 'claude-acp',
  codex: 'codex-acp',
  gemini: 'gemini',
  grok: 'grok',
  opencode: 'opencode',
  pi: 'pi',
};

/**
 * Known-good launch commands, used when the registry is unreachable. Kept
 * deliberately small: the registry is the source of truth.
 */
const FALLBACK: Record<string, AcpAgentEntry> = {
  'claude-acp': { id: 'claude-acp', name: 'Claude Agent', version: '0.70.0', command: 'npx', args: ['-y', '@agentclientprotocol/claude-agent-acp@0.70.0'] },
  'codex-acp': { id: 'codex-acp', name: 'Codex', version: '1.6.2', command: 'npx', args: ['-y', '@agentclientprotocol/codex-acp@1.6.2'] },
  gemini: { id: 'gemini', name: 'Gemini CLI', version: 'latest', command: 'npx', args: ['-y', '@google/gemini-cli', '--acp'] },
  grok: { id: 'grok', name: 'Grok', version: 'latest', command: 'npx', args: ['-y', '@xai-official/grok', 'agent', 'stdio'] },
  opencode: { id: 'opencode', name: 'opencode', version: 'local', command: 'opencode', args: ['acp'] },
};

interface RegistryManifest {
  id: string;
  name?: string;
  version?: string;
  distribution?: {
    npx?: { package: string; args?: string[] };
    binary?: Record<string, { url: string; sha256?: string }>;
  };
  /** Some agents declare the subcommand that puts the CLI in ACP mode. */
  acpArgs?: string[];
}

interface CacheShape {
  fetchedAt: number;
  agents: Record<string, AcpAgentEntry>;
}

let memo: CacheShape | null = null;

function readCache(): CacheShape | null {
  if (memo) return memo;
  try {
    memo = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8')) as CacheShape;
    return memo;
  } catch {
    return null;
  }
}

function writeCache(cache: CacheShape): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
    memo = cache;
  } catch {
    // a cache we cannot write costs a fetch, not correctness
  }
}

function manifestToEntry(manifest: RegistryManifest, fallbackArgs?: string[]): AcpAgentEntry | null {
  const npx = manifest.distribution?.npx;
  if (!npx?.package) return null;
  return {
    id: manifest.id,
    name: manifest.name || manifest.id,
    version: manifest.version || 'latest',
    command: 'npx',
    args: ['-y', npx.package, ...(npx.args ?? manifest.acpArgs ?? fallbackArgs ?? [])],
  };
}

/** Refreshes the launch table at most once a day. Never throws. */
export async function loadAcpRegistry(force = false): Promise<Record<string, AcpAgentEntry>> {
  const cached = readCache();
  if (!force && cached && Date.now() - cached.fetchedAt < TTL_MS) return cached.agents;

  const agents: Record<string, AcpAgentEntry> = { ...FALLBACK, ...(cached?.agents ?? {}) };

  await Promise.all(Object.values(PROVIDER_TO_ACP).map(async agentId => {
    if (!agentId) return;
    try {
      const res = await fetch(`${REGISTRY_BASE}/${agentId}/agent.json`, {
        headers: { 'User-Agent': 'Tars' },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) return;
      const entry = manifestToEntry(await res.json() as RegistryManifest, FALLBACK[agentId]?.args.slice(2));
      if (entry) agents[agentId] = entry;
    } catch {
      // keep whatever we already had for this agent
    }
  }));

  writeCache({ fetchedAt: Date.now(), agents });
  return agents;
}

/** How to launch this provider over ACP, or null if it has no ACP mode. */
export function acpLaunchFor(provider: AgentProvider): AcpAgentEntry | null {
  const agentId = PROVIDER_TO_ACP[provider];
  if (!agentId) return null;
  const cached = readCache();
  return cached?.agents[agentId] ?? FALLBACK[agentId] ?? null;
}

export function providerSupportsAcp(provider: AgentProvider): boolean {
  return acpLaunchFor(provider) !== null;
}

/** Test seam. */
export function resetAcpRegistryCache(): void {
  memo = null;
}
