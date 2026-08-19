import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock electron before importing utils
vi.mock('electron', () => ({
  app: {
    getAppPath: () => '/mock/app/path',
  },
  Notification: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    show: vi.fn(),
  })),
  BrowserWindow: vi.fn(),
}));

import {
  isSuperAgent,
  getSuperAgent,
  formatAgentStatus,
  formatSlackAgentStatus,
} from '../../electron/utils';
import type { AgentStatus } from '../../electron/types';

function makeAgent(overrides: Partial<AgentStatus> = {}): AgentStatus {
  return {
    id: 'test-id',
    status: 'idle',
    projectPath: '/home/user/projects/my-app',
    skills: [],
    output: [],
    lastActivity: new Date().toISOString(),
    ...overrides,
  };
}

describe('isSuperAgent', () => {
  it('returns true for "Super Agent" name', () => {
    expect(isSuperAgent(makeAgent({ name: 'Super Agent' }))).toBe(true);
  });

  it('returns true for "super agent" (case insensitive)', () => {
    expect(isSuperAgent(makeAgent({ name: 'My super agent' }))).toBe(true);
  });

  it('returns true for "orchestrator" name', () => {
    expect(isSuperAgent(makeAgent({ name: 'orchestrator' }))).toBe(true);
  });

  it('returns false for regular agent names', () => {
    expect(isSuperAgent(makeAgent({ name: 'Backend Worker' }))).toBe(false);
    expect(isSuperAgent(makeAgent({ name: 'Test Runner' }))).toBe(false);
  });

  it('returns false when name is undefined', () => {
    expect(isSuperAgent(makeAgent({ name: undefined }))).toBe(false);
  });

  it('role field is authoritative over the name', () => {
    // A worker whose name happens to contain "orchestrator" is NOT a super
    // agent, and an orchestrator with an arbitrary name IS one.
    expect(isSuperAgent(makeAgent({ name: 'orchestrator docs writer', role: 'worker' }))).toBe(false);
    expect(isSuperAgent(makeAgent({ name: 'Dorothy', role: 'orchestrator' }))).toBe(true);
  });
});

describe('getSuperAgent', () => {
  it('finds the super agent in a map', () => {
    const agents = new Map<string, AgentStatus>();
    agents.set('1', makeAgent({ id: '1', name: 'Worker' }));
    agents.set('2', makeAgent({ id: '2', name: 'Super Agent' }));
    agents.set('3', makeAgent({ id: '3', name: 'Tester' }));

    const result = getSuperAgent(agents);
    expect(result?.id).toBe('2');
  });

  it('returns undefined when no super agent exists', () => {
    const agents = new Map<string, AgentStatus>();
    agents.set('1', makeAgent({ id: '1', name: 'Worker' }));

    expect(getSuperAgent(agents)).toBeUndefined();
  });

  it('returns undefined for empty map', () => {
    expect(getSuperAgent(new Map())).toBeUndefined();
  });

  it('scopes to the requested project when projectPath is given', () => {
    // The old cross-project bug: three orchestrators (one per project) and
    // getSuperAgent returned whichever came first in the map.
    const agents = new Map<string, AgentStatus>();
    agents.set('1', makeAgent({ id: '1', name: 'Orchestrator', projectPath: '/proj/tars' }));
    agents.set('2', makeAgent({ id: '2', name: 'Orchestrator', projectPath: '/proj/dorothy' }));

    expect(getSuperAgent(agents, '/proj/dorothy')?.id).toBe('2');
    expect(getSuperAgent(agents, '/proj/tars')?.id).toBe('1');
    expect(getSuperAgent(agents, '/proj/unknown')).toBeUndefined();
    // Without a project (Telegram/Slack context), first orchestrator wins.
    expect(getSuperAgent(agents)?.id).toBe('1');
  });
});

describe('formatAgentStatus', () => {
  it('formats super agent with crown emoji', () => {
    const agent = makeAgent({ name: 'Super Agent', status: 'running' });
    const result = formatAgentStatus(agent);
    expect(result).toContain('👑');
    expect(result).toContain('*Super Agent*');
    expect(result).toContain('🟢');
  });

  it('formats regular agent with character emoji', () => {
    const agent = makeAgent({ name: 'Worker', character: 'ninja', status: 'idle' });
    const result = formatAgentStatus(agent);
    expect(result).toContain('🥷');
    expect(result).toContain('*Worker*');
    expect(result).toContain('⚪');
  });

  it('shows status emojis correctly', () => {
    expect(formatAgentStatus(makeAgent({ name: 'A', status: 'idle' }))).toContain('⚪');
    expect(formatAgentStatus(makeAgent({ name: 'A', status: 'running' }))).toContain('🟢');
    expect(formatAgentStatus(makeAgent({ name: 'A', status: 'completed' }))).toContain('✅');
    expect(formatAgentStatus(makeAgent({ name: 'A', status: 'error' }))).toContain('🔴');
    expect(formatAgentStatus(makeAgent({ name: 'A', status: 'waiting' }))).toContain('🟡');
  });

  it('truncates long task names', () => {
    const agent = makeAgent({ name: 'A', currentTask: 'A'.repeat(100) });
    const result = formatAgentStatus(agent);
    expect(result).toContain('...');
  });

  it('shows project for non-super agents', () => {
    const agent = makeAgent({ name: 'Worker', projectPath: '/home/user/my-project' });
    const result = formatAgentStatus(agent);
    expect(result).toContain('`my-project`');
  });

  it('hides project for super agents', () => {
    const agent = makeAgent({ name: 'Super Agent', projectPath: '/home/user/my-project' });
    const result = formatAgentStatus(agent);
    expect(result).not.toContain('Project:');
  });
});

describe('formatSlackAgentStatus', () => {
  it('uses Slack emoji codes', () => {
    const agent = makeAgent({ name: 'Worker', character: 'robot', status: 'running', skills: [] });
    const result = formatSlackAgentStatus(agent);
    expect(result).toContain(':robot_face:');
    expect(result).toContain(':large_green_circle:');
  });

  it('shows skills when present', () => {
    const agent = makeAgent({ name: 'Worker', skills: ['skill1', 'skill2'], status: 'idle' });
    const result = formatSlackAgentStatus(agent);
    expect(result).toContain(':wrench:');
    expect(result).toContain('skill1');
  });

  it('truncates skills list beyond 3', () => {
    const agent = makeAgent({ name: 'Worker', skills: ['a', 'b', 'c', 'd'], status: 'idle' });
    const result = formatSlackAgentStatus(agent);
    expect(result).toContain('...');
  });

  it('shows current task when running', () => {
    const agent = makeAgent({ name: 'Worker', status: 'running', currentTask: 'Fix bug', skills: [] });
    const result = formatSlackAgentStatus(agent);
    expect(result).toContain('Fix bug');
  });
});

