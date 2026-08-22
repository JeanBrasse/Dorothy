import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { computeTranscriptUsage, clearTranscriptUsageCache } from '../../../electron/services/transcript-usage';

let home: string;

function writeTranscript(name: string, lines: unknown[]) {
  const dir = path.join(home, '.claude', 'projects', 'demo');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), lines.map(l => JSON.stringify(l)).join('\n'));
}

function assistant(id: string, requestId: string, over: Record<string, unknown> = {}) {
  return {
    type: 'assistant',
    requestId,
    timestamp: '2026-08-20T12:00:00.000Z',
    message: {
      id,
      model: 'claude-opus-5',
      usage: {
        input_tokens: 1000,
        output_tokens: 500,
        cache_read_input_tokens: 2000,
        cache_creation_input_tokens: 4000,
        cache_creation: { ephemeral_1h_input_tokens: 4000, ephemeral_5m_input_tokens: 0 },
        ...over,
      },
    },
  };
}

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'tars-usage-'));
  clearTranscriptUsageCache();
});

afterEach(() => {
  fs.rmSync(home, { recursive: true, force: true });
  clearTranscriptUsageCache();
});

describe('computeTranscriptUsage', () => {
  it('sums tokens per model from the transcripts', () => {
    writeTranscript('a.jsonl', [assistant('msg_1', 'req_1'), assistant('msg_2', 'req_2')]);

    const { modelUsage } = computeTranscriptUsage(home);

    expect(modelUsage['claude-opus-5'].inputTokens).toBe(2000);
    expect(modelUsage['claude-opus-5'].outputTokens).toBe(1000);
    expect(modelUsage['claude-opus-5'].cacheReadInputTokens).toBe(4000);
  });

  it('counts a resumed message once, not once per transcript', () => {
    writeTranscript('a.jsonl', [assistant('msg_1', 'req_1')]);
    writeTranscript('b-resumed.jsonl', [assistant('msg_1', 'req_1'), assistant('msg_9', 'req_9')]);

    const { modelUsage } = computeTranscriptUsage(home);

    expect(modelUsage['claude-opus-5'].inputTokens).toBe(2000);
  });

  it('prices 1h cache writes above 5m ones', () => {
    writeTranscript('hour.jsonl', [assistant('msg_1', 'req_1')]);
    const hourly = computeTranscriptUsage(home).modelUsage['claude-opus-5'].costUSD;

    clearTranscriptUsageCache();
    fs.rmSync(path.join(home, '.claude', 'projects', 'demo'), { recursive: true });
    writeTranscript('five.jsonl', [
      assistant('msg_1', 'req_1', {
        cache_creation: { ephemeral_1h_input_tokens: 0, ephemeral_5m_input_tokens: 4000 },
      }),
    ]);
    const fiveMin = computeTranscriptUsage(home).modelUsage['claude-opus-5'].costUSD;

    expect(hourly).toBeGreaterThan(fiveMin);
    // Opus 5: 4000 tokens at $10/MTok vs $6.25/MTok
    expect(hourly - fiveMin).toBeCloseTo((4000 / 1e6) * (10 - 6.25), 6);
  });

  it('ignores synthetic messages and rolls tokens up per day', () => {
    writeTranscript('a.jsonl', [
      assistant('msg_1', 'req_1'),
      { ...assistant('msg_2', 'req_2'), message: { id: 'msg_2', model: '<synthetic>', usage: { input_tokens: 99 } } },
    ]);

    const usage = computeTranscriptUsage(home);

    expect(Object.keys(usage.modelUsage)).toEqual(['claude-opus-5']);
    expect(usage.dailyModelTokens).toEqual([
      { date: '2026-08-20', tokensByModel: { 'claude-opus-5': 1500 } },
    ]);
    expect(usage.lastComputedDate).toBe('2026-08-20');
  });
});
