// Manifeste exécutable des surfaces de l'app — la contrepartie vivante de
// design/UI-INVENTORY.md. Chaque entrée est ouverte dans la VRAIE app Electron
// par e2e/surfaces.spec.ts, photographiée, et comparée à sa référence.
// `check-coverage.mjs` échoue si une page de l'inventaire manque ici.

/**
 * @typedef {Object} Surface
 * @property {string} name    identifiant stable (nom du screenshot)
 * @property {string} route   route Next à charger
 * @property {string=} clickText   texte d'un bouton à cliquer après chargement (ouvre un overlay)
 * @property {string=} clickText2  second clic (navigation dans l'overlay)
 * @property {number=} settle      ms d'attente avant screenshot (défaut 900)
 */

/** @type {Surface[]} */
export const PAGES = [
  { name: 'dashboard', route: '/' },
  { name: 'agents', route: '/agents' },
  { name: 'kanban', route: '/kanban' },
  { name: 'vault', route: '/vault' },
  { name: 'projects', route: '/projects' },
  { name: 'extensions-skills', route: '/skills' },
  { name: 'extensions-plugins', route: '/skills', clickText: 'Plugins', settle: 1500 },
  { name: 'usage', route: '/usage' },
  { name: 'brain-agents', route: '/memory' },
  { name: 'brain-projects', route: '/memory', clickText: 'Projects' },
  { name: 'brain-backends', route: '/memory', clickText: 'Backends' },
  { name: 'whats-new', route: '/whats-new' },
  { name: 'settings-general', route: '/settings' },
];

// Les 18 sections de Settings, chacune un clic dans la sidebar de la page.
export const SETTINGS_SECTIONS = [
  'Terminal', 'AI Providers', 'CLI Paths', 'Obsidian', 'Git', 'Notifications',
  'Telegram', 'Slack', 'X (Twitter)', 'Tasmania', 'Google Workspace',
  'Permissions', 'Skills & Plugins', 'Hermes', 'Memory Backends', 'Custom MCP', 'System',
].map(label => ({
  name: 'settings-' + label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
  route: '/settings',
  clickText: label,
}));

// Overlays dont le déclencheur est connu et stable. Les autres entrées de
// l'inventaire sont ajoutées ici au fur et à mesure que le redesign les touche
// (check-coverage.mjs liste celles qui restent non automatisées).
export const OVERLAYS = [
  { name: 'overlay-new-agent', route: '/agents', clickText: 'Agent' },
  // Templates now live inside the creation flow, not as a top-level button.
  { name: 'overlay-templates-manager', route: '/agents', clickText: 'Agent', clickText2: 'Manage templates', settle: 1500 },
  { name: 'overlay-deploy-team', route: '/agents', clickText: '+ Team' },
];

export const ALL = [...PAGES, ...SETTINGS_SECTIONS, ...OVERLAYS];
