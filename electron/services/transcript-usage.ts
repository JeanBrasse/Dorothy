import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { priceFor } from './model-catalog';

/**
 * Token usage read from the Claude Code transcripts themselves.
 *
 * Claude Code only writes ~/.claude/stats-cache.json for some account types;
 * without it the Usage page had no tokens and therefore no cost at all. Every
 * assistant message in ~/.claude/projects/**\/*.jsonl carries its own usage
 * block, so the numbers are right there — that is what this reads.
 */

export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  /** 1h cache writes cost 2x base, 5m writes 1.25x — kept apart to price them */
  cacheCreation1hTokens: number;
  cacheCreation5mTokens: number;
  webSearchRequests: number;
  costUSD: number;
}

export interface TranscriptUsage {
  modelUsage: Record<string, ModelUsage>;
  dailyModelTokens: Array<{ date: string; tokensByModel: Record<string, number> }>;
  /** Most recent day with real activity */
  lastComputedDate: string | null;
}

interface Pricing {
  input: number;
  output: number;
  cacheRead: number;
  cache5m: number;
  cache1h: number;
}

/** Used only when the live catalogue has never been reachable. */
const FALLBACK: Record<string, Pricing> = {
  fable: { input: 10, output: 50, cacheRead: 1, cache5m: 12.5, cache1h: 20 },
  mythos: { input: 10, output: 50, cacheRead: 1, cache5m: 12.5, cache1h: 20 },
  opus: { input: 5, output: 25, cacheRead: 0.5, cache5m: 6.25, cache1h: 10 },
  sonnet: { input: 3, output: 15, cacheRead: 0.3, cache5m: 3.75, cache1h: 6 },
  haiku: { input: 1, output: 5, cacheRead: 0.1, cache5m: 1.25, cache1h: 2 },
};

/**
 * Live price for a model. models.dev publishes input/output/cache_read and the
 * 5m cache_write; the 1h write is 2x base where the 5m one is 1.25x, which is
 * how Anthropic prices both, so it is derived rather than guessed.
 */
function pricingFor(modelId: string): Pricing {
  const live = priceFor(modelId, 'claude');
  if (live && typeof live.input === 'number' && typeof live.output === 'number') {
    const input = live.input;
    return {
      input,
      output: live.output,
      cacheRead: live.cache_read ?? input * 0.1,
      cache5m: live.cache_write ?? input * 1.25,
      cache1h: input * 2,
    };
  }
  const id = modelId.toLowerCase();
  for (const key of Object.keys(FALLBACK)) {
    if (id.includes(key)) return FALLBACK[key];
  }
  return FALLBACK.sonnet;
}

function emptyUsage(): ModelUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0,
    cacheCreation1hTokens: 0,
    cacheCreation5mTokens: 0,
    webSearchRequests: 0,
    costUSD: 0,
  };
}

/** Every *.jsonl under ~/.claude/projects, at any depth. */
function listTranscripts(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string, depth: number) => {
    if (depth > 4) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, depth + 1);
      else if (entry.name.endsWith('.jsonl')) out.push(full);
    }
  };
  walk(root, 0);
  return out;
}

let cache: { at: number; value: TranscriptUsage } | null = null;
const CACHE_TTL = 60_000;

export function computeTranscriptUsage(homeDir = os.homedir()): TranscriptUsage {
  if (cache && Date.now() - cache.at < CACHE_TTL) return cache.value;

  const root = path.join(homeDir, '.claude', 'projects');
  // Null-prototype: a transcript's model id is attacker-influenceable, and
  // `modelUsage[model] ||= …` on a plain object would let "__proto__" write
  // onto Object.prototype inside the main process.
  const modelUsage: Record<string, ModelUsage> = Object.create(null);
  const dailyMap = new Map<string, Record<string, number>>();
  let lastComputedDate: string | null = null;

  // Resuming a session copies earlier assistant messages into the new
  // transcript: on a real history that is over half the lines, so counting
  // them twice would roughly double every cost on the page.
  const seen = new Set<string>();

  for (const file of listTranscripts(root)) {
    let content: string;
    try {
      content = fs.readFileSync(file, 'utf-8');
    } catch {
      continue;
    }

    for (const line of content.split('\n')) {
      if (!line.includes('"usage"')) continue;

      let entry: Record<string, unknown>;
      try {
        entry = JSON.parse(line);
      } catch {
        continue;
      }
      if (entry.type !== 'assistant') continue;

      const message = entry.message as Record<string, unknown> | undefined;
      const usage = message?.usage as Record<string, unknown> | undefined;
      if (!message || !usage) continue;

      const model = typeof message.model === 'string' ? message.model : null;
      if (!model || model === '<synthetic>') continue;
      if (model === '__proto__' || model === 'constructor' || model === 'prototype') continue;

      const key = `${message.id ?? ''}:${entry.requestId ?? ''}`;
      if (key !== ':' && seen.has(key)) continue;
      seen.add(key);

      const bucket = (modelUsage[model] ||= emptyUsage());
      const input = Number(usage.input_tokens) || 0;
      const output = Number(usage.output_tokens) || 0;
      const cacheRead = Number(usage.cache_read_input_tokens) || 0;
      const cacheWrite = Number(usage.cache_creation_input_tokens) || 0;
      const split = usage.cache_creation as Record<string, unknown> | undefined;
      const write1h = Number(split?.ephemeral_1h_input_tokens) || 0;
      const write5m = Number(split?.ephemeral_5m_input_tokens) || (split ? 0 : cacheWrite);
      const searches = Number(
        (usage.server_tool_use as Record<string, unknown> | undefined)?.web_search_requests,
      ) || 0;

      bucket.inputTokens += input;
      bucket.outputTokens += output;
      bucket.cacheReadInputTokens += cacheRead;
      bucket.cacheCreationInputTokens += cacheWrite;
      bucket.cacheCreation1hTokens += write1h;
      bucket.cacheCreation5mTokens += write5m;
      bucket.webSearchRequests += searches;

      const price = pricingFor(model);
      bucket.costUSD +=
        (input / 1e6) * price.input +
        (output / 1e6) * price.output +
        (cacheRead / 1e6) * price.cacheRead +
        (write5m / 1e6) * price.cache5m +
        (write1h / 1e6) * price.cache1h;

      const timestamp = typeof entry.timestamp === 'string' ? entry.timestamp : null;
      const date = timestamp ? timestamp.slice(0, 10) : null;
      if (date) {
        const day = dailyMap.get(date) ?? {};
        day[model] = (day[model] || 0) + input + output;
        dailyMap.set(date, day);
        if (!lastComputedDate || date > lastComputedDate) lastComputedDate = date;
      }
    }
  }

  const value: TranscriptUsage = {
    modelUsage: { ...modelUsage },
    dailyModelTokens: Array.from(dailyMap.entries())
      .map(([date, tokensByModel]) => ({ date, tokensByModel }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    lastComputedDate,
  };

  cache = { at: Date.now(), value };
  return value;
}

/** Drops the memo so a test or a refresh sees fresh numbers. */
export function clearTranscriptUsageCache(): void {
  cache = null;
}
