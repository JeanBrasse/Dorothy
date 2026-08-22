import {
  Brain,
  Settings,
  GitCommit,
  Bell,
  Send,
  Shield,
  Sparkles,
  Monitor,
  Terminal,
  Twitter,
  Cloud,
  Plug,
  Zap,
} from 'lucide-react';
import { SlackIcon } from './SlackIcon';
import { TasmaniaIcon } from './TasmaniaIcon';
import type { SettingsSection } from './types';

export interface SettingsGroup {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children: { id: SettingsSection; label: string; icon: React.ComponentType<{ className?: string }> }[];
}

/**
 * Seventeen flat entries meant scrolling a list to find anything, and five of
 * them were a single vendor. Same seventeen screens, six doors.
 */
export const SECTION_GROUPS: SettingsGroup[] = [
  {
    id: 'general',
    label: 'General',
    icon: Settings,
    children: [
      { id: 'general', label: 'Preferences', icon: Settings },
      { id: 'terminal', label: 'Terminal', icon: Terminal },
      { id: 'notifications', label: 'Notifications', icon: Bell },
      { id: 'system', label: 'System', icon: Monitor },
    ],
  },
  {
    id: 'ai',
    label: 'AI & Providers',
    icon: Zap,
    children: [
      { id: 'ai-providers', label: 'Providers', icon: Zap },
      { id: 'cli', label: 'CLI Paths', icon: Terminal },
      { id: 'permissions', label: 'Permissions', icon: Shield },
    ],
  },
  {
    id: 'hermes',
    label: 'Hermes',
    icon: Send,
    children: [
      { id: 'hermes', label: 'Connection', icon: Send },
    ],
  },
  {
    id: 'integrations',
    label: 'Integrations',
    icon: Plug,
    children: [
      { id: 'telegram', label: 'Telegram', icon: Send },
      { id: 'slack', label: 'Slack', icon: SlackIcon },
      { id: 'socialdata', label: 'X (Twitter)', icon: Twitter },
      { id: 'google-workspace', label: 'Google Workspace', icon: Cloud },
    ],
  },
  {
    id: 'extensions',
    label: 'Extensions',
    icon: Sparkles,
    children: [
      { id: 'skills', label: 'Skills & Plugins', icon: Sparkles },
      { id: 'mcp', label: 'Custom MCP', icon: Plug },
      { id: 'tasmania', label: 'Tasmania', icon: TasmaniaIcon },
    ],
  },
  {
    id: 'workspace',
    label: 'Workspace',
    icon: GitCommit,
    children: [
      { id: 'git', label: 'Git', icon: GitCommit },
      { id: 'memory', label: 'Memory Backends', icon: Brain },
    ],
  },
];

/** Flat view of the same sections, for deep-links and the mobile picker. */
export const SECTIONS: { id: SettingsSection; label: string; icon: React.ComponentType<{ className?: string }> }[] =
  SECTION_GROUPS.flatMap(g => g.children);

export const DEFAULT_APP_SETTINGS = {
  notificationsEnabled: true,
  notifyOnWaiting: true,
  notifyOnComplete: true,
  notifyOnStop: true,
  notifyOnError: true,
  telegramEnabled: false,
  telegramBotToken: '',
  telegramChatId: '',
  telegramAuthToken: '',
  telegramAuthorizedChatIds: [] as string[],
  telegramRequireMention: false,
  slackEnabled: false,
  slackBotToken: '',
  slackAppToken: '',
  slackSigningSecret: '',
  slackChannelId: '',
  socialDataEnabled: false,
  socialDataApiKey: '',
  xPostingEnabled: false,
  xApiKey: '',
  xApiSecret: '',
  xAccessToken: '',
  xAccessTokenSecret: '',
  tasmaniaEnabled: false,
  tasmaniaServerPath: '',
  gwsEnabled: false,
  gwsSkillsInstalled: false,
  verboseModeEnabled: false,
  chromeEnabled: false,
  autoCheckUpdates: true,
  opencodeEnabled: false,
  opencodeDefaultModel: '',
  openRouterEnabled: false,
  openRouterApiKey: '',
  deepSeekEnabled: false,
  deepSeekApiKey: '',
  mimoEnabled: false,
  mimoApiKey: '',
  moonshotEnabled: false,
  moonshotApiKey: '',
  qwenEnabled: false,
  qwenApiKey: '',
  zhipuEnabled: false,
  zhipuApiKey: '',
  minimaxEnabled: false,
  minimaxApiKey: '',
  nvidiaEnabled: false,
  nvidiaApiKey: '',
  nousPortalEnabled: false,
  nousPortalApiKey: '',
  defaultProvider: 'claude',
  obsidianVaultPaths: [] as string[],
  terminalFontSize: 11,
  terminalTheme: 'dark' as const,
  statusLineEnabled: false,
  hermesGatewayUrl: '',
  hermesGatewayToken: '',
  memoryGbrainEnabled: false,
  memoryGbrainMcpUrl: '',
  memoryGbrainAuthToken: '',
  memoryHonchoEnabled: false,
  memoryHonchoMcpUrl: 'https://mcp.honcho.dev',
  memoryHonchoApiKey: '',
  favoriteProjects: [] as string[],
  hiddenProjects: [] as string[],
  cliPaths: {
    claude: '',
    codex: '',
    gemini: '',
    grok: '',
    qwencode: '',
    opencode: '',
    pi: '',
    gws: '',
    gcloud: '',
    gh: '',
    node: '',
    minimax: '',
    additionalPaths: [],
  },
};
