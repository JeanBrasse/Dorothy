# UI Inventory — Redesign Cooperlabs

Contrat de couverture du redesign. **Une case non cochée = du travail restant.**
Le lint des « Garde-fous » (en bas) échoue tant qu'il reste des styles interdits —
rien ne peut être oublié silencieusement.

## Méthode (4 couches)

1. **Tokens d'abord** — `src/app/globals.css` porte 160 variables CSS consommées
   par **2 183 usages** de classes sémantiques (`bg-card`, `border-border`,
   `text-muted-foreground`…). Rethemer ces variables = ~80 % de l'app restylée
   en un commit, y compris les fenêtres et menus qu'on n'a jamais ouverts.
2. **Primitives partagées** — créer `src/components/ui/` (Button, IconButton,
   Input, Select, Toggle, Dialog, Dropdown, Tabs, StatusDot, Badge, Toast) puis
   migrer les usages ad hoc vers elles. Toute retouche future = un seul endroit.
3. **Passe surface par surface** — cocher chaque page/overlay/menu ci-dessous.
4. **Garde-fous automatiques** — grep-lint qui interdit le retour du slop
   (palette tailwind directe, hex en dur, shadows, gradients, rounded-xl+).

## Palette (source : brand.cooperlabs.xyz)

| Token | Dark | Light |
|---|---|---|
| bg | `#121212` | `#FAF9F7` |
| surface | `#1A1A1A` | `#FFFFFF` |
| surface-raised | `#222222` | `#F3F1EE` |
| term-bg | `#0F0F0F` | `#FCFBFA` |
| border / border-strong | `#2A2A2A` / `#3A3A3A` | `#E6E3DE` / `#CFCBC4` |
| text-primary | `#F5F4F2` | `#1E1E1E` (slate 900) |
| text-secondary | `#9B9B9B` (slate 400) | `#5E5E5E` (slate 700) |
| text-muted | `#727272` (slate 600) | `#9B9B9B` |
| accent | `#FF9E42` (tangerine 400) | `#C77012` (tangerine 500) |
| status running / waiting / error | `#4CC38A` / `#E8C547` / `#E5534B` | `#1A7F37` / `#9A6700` / `#CF222E` |

Typo : **Roboto Condensed** (interface, labels), **Roboto Mono** (données, ids,
branches, terminaux), **PP Eiko** (display : wordmark, grands titres — fallback
Instrument Serif tant que la licence n'est pas dans le repo).

Principes : surfaces plates, bordures 1px, un seul accent, zéro ombre portée,
zéro gradient, radius unique (0–2 px), mono pour toute donnée.

## Dette à purger (mesurée le 2026-08-21)

| Problème | Volume | Résolution |
|---|---|---|
| Couleurs tailwind directes (`text-green-500`…) | 611 | → tokens sémantiques |
| Hex en dur dans les tsx | 485 | → tokens |
| `<button>` ad hoc | 399 | → primitive Button |
| `<input>` / `<select>` ad hoc | 68 / 11 | → primitives Input/Select |
| `rounded-md/lg/xl/2xl` | 119 | → radius token unique |
| `shadow-*` | 41 | → supprimé (bordures 1px) |
| fichiers avec `gradient` | 7 | → supprimé |
| `animate-ping` | 9 | → supprimé (politique motion) |

## Couche 1 — Tokens

- [x] `src/app/globals.css` : re-mappé sur cooperlabs (dark + light), dark par défaut, fonts Roboto Condensed/Mono + Instrument Serif, échelle cyan→tangerine, scrollbars, politique coins durs (2px)
- [x] radius tokens 2/2/4/6px via @theme (Tailwind v4, pas de config file) ; ombres purgées aux couches 2-3 via lint
- [ ] Wordmark/logo : un seul composant `Brand` (débrandable)

## Couche 2 — Primitives (`src/components/ui/`)

- [ ] Button (primary tangerine / secondary bordé / ghost / destructive)
- [ ] IconButton · - [ ] Input · - [ ] Select · - [ ] Toggle
- [ ] Dialog (base des 23 overlays) · - [ ] Dropdown (base des 10 menus)
- [ ] Tabs · - [ ] StatusDot + Badge · - [ ] Toast · - [ ] EmptyState

## Couche 3 — Surfaces

### Pages (11 + chrome)
- [ ] `/` Dashboard (TerminalsView)
- [ ] `/agents` (+ 18 sections de `/settings` comptées une à une ci-dessous)
- [ ] `/kanban`
- [ ] `/vault`
- [ ] `/projects`
- [ ] `/skills` (Extensions, 2 onglets)
- [ ] `/usage`
- [ ] `/memory` (Brain, 3 onglets)
- [ ] `/settings` — General, Terminal, AI Providers, CLI Paths, Obsidian, Git,
      Notifications, Telegram, Slack, X, Tasmania, Google Workspace,
      Permissions, Skills & Plugins, Hermes, Memory Backends, Custom MCP, System
      (JIRA supprimé — vestige des automations)
- [ ] `/whats-new`
- [ ] `/tray-panel`
- [ ] Sidebar + ClientLayout (chrome global, thème, scrollbars)

### Overlays — dialogs & modals (23)
- [ ] `src/app/memory/page.tsx` (NewFileModal)
- [ ] `src/app/projects/page.tsx`
- [ ] `src/components/AgentList/StartPromptModal.tsx`
- [ ] `src/components/AgentWorld/AgentTerminalDialog.tsx`
- [ ] `src/components/ClientLayout.tsx`
- [ ] `src/components/Extensions/PluginsTab.tsx`
- [ ] `src/components/Extensions/SkillsTab.tsx`
- [ ] `src/components/KanbanBoard/components/KanbanCardDetail.tsx`
- [ ] `src/components/KanbanBoard/components/KanbanDoneSummary.tsx`
- [ ] `src/components/KanbanBoard/components/NewTaskModal.tsx`
- [ ] `src/components/KanbanBoard/index.tsx`
- [ ] `src/components/NewChatModal/SkillInstallTerminal.tsx`
- [ ] `src/components/NewChatModal/index.tsx` (4 steps)
- [ ] `src/components/PluginInstallDialog.tsx`
- [ ] `src/components/Settings/InstallTerminalModal.tsx`
- [ ] `src/components/Templates/DeployTeamDialog.tsx`
- [ ] `src/components/Templates/ImportDialog.tsx`
- [ ] `src/components/Templates/InstantiateDialog.tsx`
- [ ] `src/components/Templates/TemplateFormDialog.tsx`
- [ ] `src/components/Templates/TemplatesManagerDialog.tsx`
- [ ] `src/components/TerminalDialog.tsx`
- [ ] `src/components/TerminalsView/components/TerminalPanel.tsx` (fullscreen)
- [ ] `src/components/TerminalsView/index.tsx`

### Dropdowns & menus flottants (10)
- [ ] `src/components/Dashboard/ProjectsOverview.tsx`
- [ ] `src/components/Extensions/PluginsTab.tsx`
- [ ] `src/components/KanbanBoard/index.tsx`
- [ ] `src/components/Memory/AgentKnowledgeGraph.tsx`
- [ ] `src/components/NewChatModal/StepTools.tsx` (filtre catégories)
- [ ] `src/components/TerminalsView/components/AddAgentDropdown.tsx`
- [ ] `src/components/TerminalsView/components/CustomTabBar.tsx`
- [ ] `src/components/TerminalsView/components/LayoutPresetSelector.tsx`
- [ ] `src/components/TerminalsView/components/Sidebar.tsx`
- [ ] `src/components/VaultView/components/FolderTree.tsx`

## Animations — politique motion

Inventaire : framer-motion dans **37 fichiers**, `animate-spin` ×101,
`animate-pulse` ×21, `animate-ping` ×9, `animate-bounce` ×1.

Le mouvement est **fonctionnel, jamais décoratif** :
- Gardé : spin (chargements) ; ouverture overlay/dropdown (120–150 ms ease-out,
  fade + translate 2px, UNE définition partagée dans globals.css) ; pulse discret
  1 cycle sur changement de statut d'agent.
- Supprimé : ping permanents, bounce, fades framer-motion sur contenu statique,
  animations de layout non sollicitées. Objectif : retirer framer-motion des
  surfaces où une transition CSS suffit (la lib reste pour le drag kanban).

Chaque fichier framer-motion est traité en même temps que sa surface :
ClientLayout, Sidebar (×2), memory/projects/settings/usage pages, Dashboard
(AgentActivity, LiveActivityFeed, LiveTaskFeed, ProjectsOverview, StatsCard,
TerminalLog, UsageChart), Extensions (×2), Kanban (×6), NewChatModal (×4),
AgentList/StartPromptModal, AgentWorld/AgentTerminalDialog, PluginInstallDialog,
Settings/InstallTerminalModal, TerminalDialog, TerminalsView
(BroadcastIndicator, Sidebar), Vault (×5).

## Garde-fous (couche 4)

Lint anti-régression (pré-commit / CI) — doit retourner 0 hors `components/ui/` :

```bash
grep -rnE "(text|bg|border)-(red|green|blue|amber|purple|cyan|yellow|orange|zinc|slate|gray)-[0-9]" src/ --include="*.tsx" | grep -v "components/ui/"
grep -rnE "shadow-(md|lg|xl|2xl)|bg-gradient|rounded-(xl|2xl|3xl)|animate-ping" src/ --include="*.tsx"
```

Clôture : revue adversariale multi-agents (passe visuelle par surface + greps)
une fois toutes les cases cochées.
