import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * The ledger is the only place a non-Claude CLI's usage can be counted: those
 * CLIs write no transcript, so if the turn is not recorded as it happens the
 * spend is simply invisible.
 */

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tars-ledger-'));

vi.mock('../../../electron/constants', () => ({ DATA_DIR: tmp }));
vi.mock('../../../electron/services/model-catalog', () => ({
  priceFor: (modelId: string) =>
    modelId === 'gpt-9' ? { input: 2, output: 8, cache_read: 0.2, cache_write: 2.5 } : null,
}));

let ledger: typeof import('../../../electron/services/usage-ledger');

beforeEach(async () => {
  for (const f of fs.readdirSync(tmp)) fs.rmSync(path.join(tmp, f), { force: true });
  vi.resetModules();
  ledger = await import('../../../electron/services/usage-ledger');
});

describe('recordUsage', () => {
  it('keeps the cost the agent reported', () => {
    ledger.recordUsage({
      agentId: 'a1', provider: 'claude', model: 'claude-opus-5',
      inputTokens: 10, outputTokens: 20, costUSD: 0.42, transport: 'acp',
    });

    expect(ledger.readLedger()[0].costUSD).toBe(0.42);
  });

  it('prices the turn from the catalogue when the agent reported none', () => {
    ledger.recordUsage({
      agentId: 'a1', provider: 'codex', model: 'gpt-9',
      inputTokens: 1_000_000, outputTokens: 1_000_000, transport: 'acp',
    });

    // 1M in at $2 + 1M out at $8
    expect(ledger.readLedger()[0].costUSD).toBeCloseTo(10, 6);
  });

  it('leaves the cost unset for a model nobody can price', () => {
    ledger.recordUsage({
      agentId: 'a1', provider: 'mystery', model: 'unknown-1',
      inputTokens: 100, outputTokens: 100, transport: 'acp',
    });

    expect(ledger.readLedger()[0].costUSD).toBeUndefined();
  });
});

describe('providerTotals', () => {
  it('sums turns per provider, dearest first', () => {
    ledger.recordUsage({ agentId: 'a', provider: 'claude', model: 'claude-opus-5', inputTokens: 10, outputTokens: 5, costUSD: 1, transport: 'acp' });
    ledger.recordUsage({ agentId: 'b', provider: 'claude', model: 'claude-opus-5', inputTokens: 20, outputTokens: 5, costUSD: 2, transport: 'acp' });
    ledger.recordUsage({ agentId: 'c', provider: 'gemini', model: 'gemini-3-pro', inputTokens: 1, outputTokens: 1, costUSD: 0.5, transport: 'acp' });

    const totals = ledger.providerTotals();

    expect(totals.map(t => t.provider)).toEqual(['claude', 'gemini']);
    expect(totals[0]).toMatchObject({ turns: 2, inputTokens: 30, outputTokens: 10, costUSD: 3 });
    expect(totals[0].models).toEqual(['claude-opus-5']);
  });

  it('ignores entries older than the window', () => {
    const file = ledger.ledgerPath();
    fs.writeFileSync(file, `${JSON.stringify({
      ts: '2020-01-01T00:00:00.000Z', agentId: 'old', provider: 'claude',
      inputTokens: 999, outputTokens: 999, costUSD: 99, transport: 'acp',
    })}\n`);
    ledger.recordUsage({ agentId: 'new', provider: 'claude', inputTokens: 1, outputTokens: 1, costUSD: 1, transport: 'acp' });

    const totals = ledger.providerTotals(7);

    expect(totals[0].turns).toBe(1);
    expect(totals[0].costUSD).toBe(1);
  });
});

describe('dailyCost', () => {
  it('buckets spend by day', () => {
    ledger.recordUsage({ agentId: 'a', provider: 'claude', inputTokens: 1, outputTokens: 1, costUSD: 1.5, transport: 'acp' });
    ledger.recordUsage({ agentId: 'b', provider: 'codex', inputTokens: 1, outputTokens: 1, costUSD: 2.5, transport: 'acp' });

    const today = new Date().toISOString().slice(0, 10);
    expect(ledger.dailyCost()[today]).toBeCloseTo(4, 6);
  });
});
