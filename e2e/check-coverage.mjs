// Garde de couverture : le manifeste E2E (surfaces.mjs) doit couvrir
// l'inventaire du redesign (design/UI-INVENTORY.md).
// - Pages manquantes  → ÉCHEC (exit 1)
// - Overlays/menus de l'inventaire pas encore automatisés → rapport (visible,
//   jamais silencieux), à réduire au fil du redesign.
import { readFileSync } from 'fs';
import { PAGES, SETTINGS_SECTIONS, OVERLAYS } from './surfaces.mjs';

const inventory = readFileSync(new URL('../design/UI-INVENTORY.md', import.meta.url), 'utf-8');

const ROUTE_EXPECTATIONS = [
  ['/', 'dashboard'], ['/agents', 'agents'], ['/kanban', 'kanban'], ['/vault', 'vault'],
  ['/projects', 'projects'], ['/skills', 'extensions'], ['/usage', 'usage'],
  ['/memory', 'brain'], ['/settings', 'settings'], ['/whats-new', 'whats-new'],
];

const covered = new Set([...PAGES, ...SETTINGS_SECTIONS, ...OVERLAYS].map(s => s.route));
const missingPages = ROUTE_EXPECTATIONS.filter(([route]) => !covered.has(route));

const inventoryOverlays = [...inventory.matchAll(/^- \[[ x]\] `(src\/[^`]+\.tsx)`/gm)].map(m => m[1]);
const automatedOverlayCount = OVERLAYS.length;

console.log(`Pages du manifeste E2E : ${PAGES.length} (+${SETTINGS_SECTIONS.length} sections settings)`);
console.log(`Overlays automatisés : ${automatedOverlayCount} / ${inventoryOverlays.length} listés dans l'inventaire`);
console.log('');

if (missingPages.length > 0) {
  console.error('ÉCHEC — pages de l\'inventaire absentes du manifeste E2E :');
  for (const [route] of missingPages) console.error(`  - ${route}`);
  process.exit(1);
}

const notAutomated = inventoryOverlays.length - automatedOverlayCount;
if (notAutomated > 0) {
  console.log(`À automatiser au fil du redesign (${notAutomated} surfaces d'overlay/menu) :`);
  for (const f of inventoryOverlays.slice(0, 40)) console.log(`  - ${f}`);
}
console.log('\nCouverture pages : OK ✓');
