import { ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { DATA_DIR } from '../constants';
import type {
  TeamTemplate,
  TeamTemplateInput,
  TeamTemplateMember,
  TeamTemplateStore,
} from '../types/team-template';

const TEAM_TEMPLATES_FILE = path.join(DATA_DIR, 'team-templates.json');

/** The standard project team: one orchestrator plus one dev per discipline,
 *  each discipline isolated on its own worktree branch. */
export const BUILTIN_TEAM_TEMPLATES: TeamTemplate[] = [
  {
    id: 'builtin-full-project-team',
    builtin: true,
    name: 'Full Project Team',
    description: 'Orchestrator + Frontend, Backend, QA, Audit and Database devs, each on their own worktree branch.',
    icon: '🚀',
    members: [
      { name: 'Orchestrator', character: 'wizard', provider: 'claude', permissionMode: 'auto', skills: [], orchestratorMode: true },
      { name: 'Frontend Dev', character: 'astronaut', provider: 'claude', permissionMode: 'auto', skills: [], worktreeBranch: 'feat/frontend' },
      { name: 'Backend Dev', character: 'knight', provider: 'claude', permissionMode: 'auto', skills: [], worktreeBranch: 'feat/backend' },
      { name: 'QA', character: 'ninja', provider: 'claude', permissionMode: 'auto', skills: [], worktreeBranch: 'feat/qa' },
      { name: 'Audit', character: 'pirate', provider: 'claude', permissionMode: 'auto', skills: [], worktreeBranch: 'feat/audit' },
      { name: 'Database Dev', character: 'viking', provider: 'claude', permissionMode: 'auto', skills: [], worktreeBranch: 'feat/database' },
    ],
    createdAt: '2026-08-20T00:00:00.000Z',
    updatedAt: '2026-08-20T00:00:00.000Z',
  },
];

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadStore(): TeamTemplateStore {
  ensureDir();
  if (!fs.existsSync(TEAM_TEMPLATES_FILE)) return { user: [] };
  try {
    const data = fs.readFileSync(TEAM_TEMPLATES_FILE, 'utf-8');
    if (!data.trim()) return { user: [] };
    const parsed = JSON.parse(data);
    return {
      user: Array.isArray(parsed.user)
        ? parsed.user.filter((t: TeamTemplate) => !!t && !t.builtin)
        : [],
    };
  } catch (err) {
    console.error('Failed to load team-templates.json:', err);
    return { user: [] };
  }
}

function saveStore(store: TeamTemplateStore): void {
  ensureDir();
  fs.writeFileSync(TEAM_TEMPLATES_FILE, JSON.stringify(store, null, 2));
}

function normalizeMember(raw: Partial<TeamTemplateMember>): TeamTemplateMember | null {
  if (!raw || typeof raw.name !== 'string' || !raw.name.trim()) return null;
  return {
    name: raw.name.trim(),
    character: raw.character ?? 'robot',
    provider: raw.provider ?? 'claude',
    model: raw.model,
    localModel: raw.localModel,
    permissionMode: raw.permissionMode ?? 'auto',
    effort: raw.effort,
    skills: Array.isArray(raw.skills) ? raw.skills : [],
    savedPrompt: raw.savedPrompt,
    worktreeBranch: raw.worktreeBranch?.trim() || undefined,
    orchestratorMode: raw.orchestratorMode || undefined,
  };
}

export function registerTeamTemplateHandlers(): void {
  ipcMain.handle('teamTemplate:list', async () => {
    try {
      const store = loadStore();
      return { teams: [...BUILTIN_TEAM_TEMPLATES, ...store.user] };
    } catch (err) {
      console.error('teamTemplate:list error:', err);
      return {
        teams: BUILTIN_TEAM_TEMPLATES,
        error: err instanceof Error ? err.message : 'Failed to list team templates',
      };
    }
  });

  ipcMain.handle('teamTemplate:create', async (_event, input: TeamTemplateInput) => {
    try {
      if (!input?.name?.trim()) {
        return { success: false, error: 'name is required' };
      }
      const members = (Array.isArray(input.members) ? input.members : [])
        .map(normalizeMember)
        .filter((m): m is TeamTemplateMember => m !== null);
      if (members.length === 0) {
        return { success: false, error: 'A team needs at least one member' };
      }
      const now = new Date().toISOString();
      const team: TeamTemplate = {
        id: uuidv4(),
        builtin: false,
        name: input.name.trim(),
        description: input.description ?? '',
        icon: input.icon ?? '👥',
        members,
        createdAt: now,
        updatedAt: now,
      };
      const store = loadStore();
      store.user.push(team);
      saveStore(store);
      return { success: true, team };
    } catch (err) {
      console.error('teamTemplate:create error:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Failed to create team template' };
    }
  });

  ipcMain.handle('teamTemplate:delete', async (_event, id: string) => {
    try {
      if (BUILTIN_TEAM_TEMPLATES.some(t => t.id === id)) {
        return { success: false, error: 'Built-in teams cannot be deleted.' };
      }
      const store = loadStore();
      const next = store.user.filter(t => t.id !== id);
      if (next.length === store.user.length) {
        return { success: false, error: 'Team template not found' };
      }
      store.user = next;
      saveStore(store);
      return { success: true };
    } catch (err) {
      console.error('teamTemplate:delete error:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Failed to delete team template' };
    }
  });
}
