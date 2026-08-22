---
name: Tars
description: Flat, dense control room for running many AI coding-agent CLIs side by side. Electron desktop, dark by default.
default-theme: dark
colors:
  dark:
    bg: "#121212"
    surface: "#1A1A1A"
    surface-raised: "#222222"
    surface-elevated: "#262626"
    term-bg: "#0F0F0F"
    border: "#2A2A2A"
    border-strong: "#3A3A3A"
    text-primary: "#F5F4F2"
    text-secondary: "#9B9B9B"
    text-muted: "#898989"
    accent: "#FF9E42"
    accent-dim: "#FF9E4216"
    on-accent: "#1E1E1E"
    scrim: "#00000099"
    knob: "#121212"
    status-running: "#4CC38A"
    status-waiting: "#E8C547"
    status-error: "#E5534B"
    status-idle: "#898989"
  light:
    bg: "#FAF9F7"
    surface: "#FFFFFF"
    surface-raised: "#F3F1EE"
    surface-elevated: "#FFFFFF"
    term-bg: "#F3F1EE"
    border: "#DAD6CE"
    border-strong: "#BFBAB1"
    text-primary: "#1E1E1E"
    text-secondary: "#4A4A4A"
    text-muted: "#6B6B6B"
    accent: "#C77012"
    accent-dim: "#C7701214"
    on-accent: "#1E1E1E"
    scrim: "#1E1E1E66"
    knob: "#FFFFFF"
    status-running: "#1A7F37"
    status-waiting: "#9A6700"
    status-error: "#CF222E"
    status-idle: "#6B6B6B"
typography:
  families:
    ui: Roboto Condensed
    mono: Roboto Mono
    display: Instrument Serif
  scale: [9, 9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13, 14, 15, 16, 18, 20, 24, 28, 32, 36, 40, 44]
  roles:
    page-title:     { family: display, size: 24,   weight: 400, leading: 1.15 }
    page-subtitle:  { family: ui,      size: 12.5, weight: 400, leading: 1.4 }
    wordmark:       { family: display, size: 18 }
    splash-wordmark:{ family: display, size: 36 }
    body:           { family: ui,      size: 14,   weight: 400, leading: 1.5 }
    control:        { family: ui,      size: 12,   weight: 500 }
    label:          { family: ui,      size: 12,   weight: 500 }
    section-label:  { family: ui,      size: 10,   weight: 500, transform: uppercase }
    hint:           { family: ui,      size: 10 }
    terminal:       { family: mono,    size: 13,   weight: 400 }
    value-mono:     { family: mono,    size: 12,   weight: 400 }
rounded:
  control: 2px
  dot: 999px
spacing:
  step: 8
  scale: [2, 4, 6, 8, 10, 12, 14, 16, 20, 24]
  gutters: [22, 26]
layout:
  sidebar-width: 216
  header-height: 84
  header-padding: [22, 26, 14, 26]
  content-padding: [0, 26, 22, 26]
  pane-gap: 8
  control-height-small: 26
  control-height-standard: 32
components:
  button-primary:
    height: 32
    background: "{accent}"
    text: "{on-accent}"
    border: "1px solid {accent}"
  button-secondary:
    height: 32
    background: "{surface}"
    text: "{text-primary}"
    border: "1px solid {border}"
  button-ghost:
    height: 32
    background: transparent
    text: "{text-secondary}"
    border: 1px solid transparent
  button-danger:
    height: 32
    background: transparent
    text: "{status-error}"
    border: "1px solid {status-error} @ 40%"
  field:
    height: 32
    background: "{surface-raised}"
    border: "1px solid {border}"
    focus-border: "{accent} @ 40%"
    text: 12
  nav-item-active:
    background: "{accent-dim}"
    text: "{text-primary}"
  tab-active:
    background: "{surface}"
    text: "{text-primary}"
  segmented-active:
    background: "{surface}"
    border: "1px solid {accent}"
  toggle:
    track: 30x16
    knob: 12x12
    on-track: "{accent}"
    on-knob: "{knob}"
    off-track: "{surface-raised}"
    off-knob: "#727272"
  card:
    background: "{surface}"
    border: "1px solid {border}"
    rounded: 2px
    shadow: none
  terminal-pane:
    header: "{surface}"
    body: "{term-bg}"
    border: "1px solid {border}"
  status-dot:
    size: 6
    shape: square
  brand-mark:
    size: 12
    shape: square
    color: "{accent}"
  modal:
    scrim: "{scrim}"
    panel: "{surface}"
    border: "1px solid {border}"
---

## Overview

Tars runs twenty agents at once. The screen is a wall of live terminals, agent
cards, cost figures and diffs, and the interface's whole job is to get out of
the way of that data. So: flat surfaces, no shadows, no gradients, a single 2px
radius, and colour reserved for things that mean something — an agent's state,
money, an accent on the one control you are meant to press.

Depth is done with value, not elevation. Four greys stack in dark
(`bg` → `surface` → `surface-raised` → `surface-elevated`, 18 → 26 → 34 → 38 in
sRGB) and a 1px `border` line separates anything the greys don't. A card is a
rectangle with a hairline around it. It never lifts off the page.

Three families, three jobs. **Instrument Serif** carries the page title and the
wordmark and nothing else — it is the only warm thing on the screen and it earns
its place by being rare. **Roboto Condensed** is the UI: it fits more label into
a 216px sidebar and a narrow table column than an unnarrowed grotesque, which is
the whole argument for it. **Roboto Mono** is for anything the machine wrote — terminal
output, branch names, paths, model ids, versions, token counts.

Dark is the launch default (`<html class="dark">` in `src/app/layout.tsx`, with
an inline script that reads `localStorage['tars-theme']` before first paint so a
cold start never flashes white). Light is a full peer, not a tint: every token
has a light value, and both are checked against the same contrast floor.

## Colors

The tokens live in `src/app/globals.css` — light on `:root`, dark on `.dark`,
re-exported to Tailwind through `@theme inline`.

| Token | Dark | Light | CSS variable(s) | Used for |
|---|---|---|---|---|
| `bg` | `#121212` | `#FAF9F7` | `--background`, `--bg-primary` | The page behind everything |
| `surface` | `#1A1A1A` | `#FFFFFF` | `--card`, `--popover`, `--bg-secondary` | Cards, sidebar, panels, menus |
| `surface-raised` | `#222222` | `#F3F1EE` | `--secondary`, `--muted`, `--input`, `--bg-tertiary` | Field fills, chips, skeleton bars |
| `surface-elevated` | `#262626` | `#FFFFFF` | `--bg-elevated` | The one step above a card |
| `term-bg` | `#0F0F0F` | `#F3F1EE` | — (xterm JS theme) | Inside a terminal pane |
| `border` | `#2A2A2A` | `#DAD6CE` | `--border`, `--border-primary` | Every hairline |
| `border-strong` | `#3A3A3A` | `#BFBAB1` | `--border-accent` | Hover edges, scrollbar thumb |
| `text-primary` | `#F5F4F2` | `#1E1E1E` | `--foreground`, `--text-primary` | Titles, values, active labels |
| `text-secondary` | `#9B9B9B` | `#4A4A4A` | `--muted-foreground`, `--text-secondary` | Subtitles, inactive labels |
| `text-muted` | `#898989` | `#6B6B6B` | `--text-muted` | Meta, timestamps, hints |
| `accent` | `#FF9E42` | `#C77012` | `--primary`, `--accent`, `--ring`, `--info` | The mark, one CTA, focus ring |
| `accent-dim` | `#FF9E42` @ 8.6% | `#C77012` @ 7.8% | `bg-primary/…` | Active-item fill |
| `on-accent` | `#1E1E1E` | `#1E1E1E` | `--primary-foreground` | Text on an accent fill |
| `status-running` | `#4CC38A` | `#1A7F37` | `--success` | Agent working |
| `status-waiting` | `#E8C547` | `#9A6700` | `--warning` | Agent asking |
| `status-error` | `#E5534B` | `#CF222E` | `--danger`, `--destructive` | Agent failed, destructive action |
| `status-idle` | `#898989` | `#6B6B6B` | `--color-status-idle` → `--text-muted` | Agent spawned, doing nothing |

Two colours are deliberately not what the Pencil frames drew:

- **`text-muted` dark.** The frames use `#727272`. That is 3.62:1 on a card and
  3.31:1 on a field — under AA for the 10–12px it is always used at. The code
  lifts it to `#898989`, the lightest value that clears 4.5:1 on `bg`, `surface`
  **and** `surface-raised` at once (5.36 / 4.98 / 4.55).
- **`status-idle`.** The frames drew it at `#727272` dark and `#9B9B9B` light;
  the light one is 2.64:1 on `bg`. The token is bound to `text-muted` instead,
  which is the same visual read and passes in both themes.

### Contrast, measured

Every ratio below is computed from the shipped hex values, not copied from a
comment. AA (4.5:1) is the floor for all body and control text.

**Dark** — text on `bg` / `surface` / `surface-raised` / `term-bg`:

| Colour | `#121212` | `#1A1A1A` | `#222222` | `#0F0F0F` |
|---|---|---|---|---|
| `text-primary` | 17.04 | 15.83 | 14.47 | 17.44 |
| `text-secondary` | 6.74 | 6.26 | 5.72 | 6.90 |
| `text-muted` | 5.36 | 4.98 | 4.55 | 5.48 |
| `accent` | 9.12 | 8.47 | 7.74 | 9.33 |
| `status-running` | 8.46 | 7.86 | 7.18 | 8.65 |
| `status-waiting` | 11.16 | 10.37 | 9.48 | 11.42 |
| `status-error` | 5.06 | 4.70 | 4.30 | 5.18 |

**Light** — text on `bg` / `surface` / `surface-raised`:

| Colour | `#FAF9F7` | `#FFFFFF` | `#F3F1EE` |
|---|---|---|---|
| `text-primary` | 15.84 | 16.67 | 14.79 |
| `text-secondary` | 8.42 | 8.86 | 7.86 |
| `text-muted` | 5.06 | 5.33 | 4.73 |
| `accent` | 3.47 | 3.65 | 3.24 |
| `status-running` | 4.83 | 5.08 | 4.51 |
| `status-waiting` | 4.63 | 4.87 | 4.32 |
| `status-error` | 5.09 | 5.36 | 4.75 |

Fills, and the two numbers that decide the light theme:

- `on-accent` on `accent`: **8.11:1** dark, **4.57:1** light. White on `#C77012`
  is 3.65:1 and fails, which is why `--primary-foreground` is `#1E1E1E` in both
  themes. (The frames draw the dark button's label at `#121212`, 9.12:1; the code
  uses `#1E1E1E`. Either passes; the code value is canonical.)
- `text-primary` on an `accent-dim` fill: 13.53:1 dark (`#2E261E` over `surface`),
  15.28:1 light (`#FBF4EC` over `surface`). The active nav item is legible because
  of its text colour, not its fill.
- **Light `accent` never carries body text.** 3.47:1 on `bg` clears the 3:1 large-text
  threshold and nothing else. In light it is a fill, a border, and a 24px+ figure.
  A 12px orange label in light is a bug.
- `StatusBadge` puts its own colour at 10% behind itself, which costs roughly half
  a point: dark error lands at 4.22:1, light warning at 4.29:1, light info at 3.26:1.
  Badges are therefore always redundant — the same state is on the dot and in the
  row's text. Never put the only copy of a message inside one.

## Typography

The scale, in px: **9, 9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13, 14, 15, 16, 18,
20, 24, 28, 32, 36, 40, 44.** Nothing between the steps, nothing below 9.

| Size | Family | Where |
|---|---|---|
| 36 | display | Splash wordmark |
| 24 | display | Page title (`PageHeader`) |
| 18 | display | Sidebar wordmark |
| 14 | ui | Body default (`body { font-size: 14px; line-height: 1.5 }`) |
| 13 | mono | Terminal (`xterm` `fontSize: 13`) |
| 12.5 | ui | Page subtitle |
| 12 | ui / mono | Buttons, fields, dropdowns, badges, table cells |
| 11 | ui | Dense controls, dialog footers |
| 10.5 | mono | The detail line under a slow operation |
| 10 | ui | Section labels (uppercase), dropdown hints |
| 9 | ui | Smallest counters |

`Roboto Condensed`, `Roboto Mono` and `Instrument Serif` are pulled through
`next/font/google` in `src/app/layout.tsx` and self-hosted at build time, so
there is no runtime request to Google and the app types correctly offline.
They bind to `--font-sans-loaded` / `--font-mono-loaded` / `--font-serif-loaded`,
which `@theme inline` maps to `--font-sans` / `--font-mono` / `--font-serif`.

Serif is applied only through `.font-serif` — headings default to the UI family.
Body copy runs `letter-spacing: 0.01em` and `font-feature-settings: "ss01","ss02","cv01"`.
`td`, `th`, `code` and `pre` get `font-variant-numeric: tabular-nums`, so a
column of costs or token counts never jitters as it updates.

Two `text-[8px]` survivors, in `src/components/Sidebar.tsx` and
`src/app/usage/page.tsx`, are below the scale's floor and are the only
exceptions in the tree. Don't add a third.

## Layout & Spacing

The shell is identical on all sixty-odd frames.

- **Sidebar: 216px.** `surface` fill, `border` on its right edge. Brand at the
  top (12px square + wordmark), the nav in the middle, What's new / Settings
  pinned at the bottom, and a connection line at the very bottom — a status dot,
  `connected`, and the gateway port in mono.
- **Header: 84px**, padding `[22, 26, 14, 26]`. A 24px serif title, a 12.5px
  subtitle in `text-secondary` saying what the screen is for, and the page's
  actions right-aligned on the same block. 22 + title + 2 + subtitle + 14 = 84.
  `ui/PageHeader` is the only implementation.
- **Content: padding `[0, 26, 22, 26]`.** 26px gutters left and right on every
  page, so the left edge of content is always x=242 with the sidebar open.
- **Status bar** at the foot of the content column: agent count, running count,
  branch on the left; today's spend, tokens and the gateway on the right.

The spacing step is **8** — the terminal grid's gap is 8, and card grids and
section stacks are multiples of it. Inside a component the steps are 2, 4, 6, 8,
10, 12, 14, 16, 20, 24. The shell's 22 and 26 gutters are fixed exceptions and
do not generalise: don't reach for 26 inside a card.

Control heights are **26 (small)** and **32 (standard)**. There is no third
height. A padding-driven height drifts with its content — an icon makes a button
taller than the word beside it — so `ui/Button` and `ui/Field` both hard-code
`h-[26px]` / `h-8` and a field sits flush with the button next to it.

## Components

Everything that defines raw appearance lives in `src/components/ui/`. That is
the rule `scripts/design-lint.sh` protects: it greps the tree for banned styling
and excludes exactly that directory.

### Buttons — `ui/Button`
Four variants, two sizes, nothing else. `primary` is an accent fill with
`on-accent` text; `secondary` is `surface` with a `border`; `ghost` is
`text-secondary` with a transparent border; `danger` is red text on a 40% red
border, no fill. Every variant carries a border — transparent where it should
not show — because a fill with no border renders 2px shorter than the outlined
button beside it and no two buttons in a row share an edge.

One primary per screen. The Dashboard's is `+ Terminal`; Agents' is `+ Team`.

### Fields — `ui/Field`
`Label`, `Input`, `Select`, `Textarea`. 32px tall, `surface-raised` fill, 1px
`border`, 12px text, `border` → `accent @ 40%` on focus. Errors put a red border
on the field and one short line of red text under it saying what is wrong
(`must start with http://`), never a tooltip.

### Dropdown — `ui/Dropdown`
The themed replacement for `<select>`. A native select renders its popup through
the OS and ignores the palette entirely, so every model picker looked like a
stock macOS menu; this draws the list itself on `surface` with a `border`, a
lucide `check` on the selected row, and an optional right-aligned hint (price
per million, model id). Closes on outside mousedown and on Escape.

### Tabs and the segmented control
Project tabs on the Dashboard: the active tab is a `surface` box against the
`bg` strip. Layout presets (`1×1 2×1 2×2 3×2`) and the theme picker
(`Dark Light System`) are segmented controls: one row of 26px cells, the active
cell filled `surface` with an `accent` border. In both cases the state is the
box. There is no underline and no bar.

### Toggle
A 30×16 track with a 12×12 square knob and a 2px inset. On: `accent` track,
`knob`-coloured knob, knob right. Off: `surface-raised` track, `#727272` knob,
knob left. Square, like everything else.

### Cards and panels
`surface` fill, 1px `border`, 2px radius, no shadow. An agent card is: a 6px
status square + the agent's name, the state word right-aligned in its status
colour, one line of description in `text-secondary`, a row of mono chips
(provider, model, branch), then a row of 26px buttons (`open stop edit`).

### Terminal panes
A 32px `surface` header — status square, agent name, branch in mono, model id
right-aligned, and a `⋯` menu — over a `term-bg` body. xterm gets its palette as
a JS object in `src/components/Terminal.tsx` rather than from CSS variables; it
is the one surface the tokens don't reach, and the one place the pre-fork teal
(`#3D9B94`) still survives.

### Status dots and badges — `ui/StatusBadge`
The frames draw the agent mark as a 6px **square**, in the state's colour — the
same shape as the brand mark, one size down. `ui/StatusBadge` still ships
`StatusDot` as a 6px circle; that is the only round shape left in the app, and
it is tolerated at 6px and nowhere larger. `StatusBadge` is a bordered pill of
the tone's colour at 10% fill / 25% border. Five tones: success, warning,
danger, info, neutral. No raw colours anywhere else.

### Modals
Full-bleed `scrim`, then a `surface` panel with a `border`. Header band: serif
title, subtitle, divider. Footer band: divider, cancel on the left, the
forward action on the right, the primary last. Multi-step dialogs (New agent →
Project / Model / Tools / Task) put a row of step chips under the header — a
16px numbered square plus a label, the current one boxed in `surface-raised`
with an accent square.

### Loading — `ui/Loading`
Three stages, because a spinner that shows for 200ms is a flash and one that
spins for eight seconds says nothing:

1. **Under 400ms — nothing.** No spinner, no flash.
2. **400ms–3s — a skeleton in the real shape of the content.** `surface-raised`
   bars inside real bordered rows, so the layout does not jump when data lands.
3. **Past 3s — name what is slow.** `SquarePulse`, one line saying what is being
   waited on (`Still reading the Hermes gateway…`), the endpoint and elapsed
   seconds in 10.5px mono, and a Cancel button.

The launch sequence uses the same vocabulary: the 4×4 `SquareGrid` fills as the
main process reports each step (reading projects, detecting providers,
connecting to Hermes), then the wordmark fades in.

## Do's and Don'ts

- **Don't use an accent rule.** Never a 2px orange bar to the left of, or under,
  an active item. Active state is carried by the *box*: an `accent-dim` fill for
  nav and menu rows, or `surface` + `border` for tabs and segmented cells. The
  label of an active nav item stays `text-primary` — measured off the frames, the
  active and inactive rows differ only by fill and by `text-primary` vs
  `text-secondary`. Orange rules and orange labels are AI design slop, and in
  light they also fail contrast.
- **Don't use `>_` as a mark.** The mark is an orange **square**. Loaders and the
  app icon are a 4×4 grid of them that fills. `src/components/Brand.tsx` is the
  single source of the identity — rebranding is editing that file and the OS icon,
  nothing else.
- **Don't add a shadow.** `scripts/design-lint.sh` fails on `shadow-sm|md|lg|xl|2xl`,
  and `globals.css` neutralises anything matching `[class*="shadow-"]` with
  `box-shadow: none !important`. The dead `.card-hover` / `.hover-lift` /
  `.shadow-elevated` utilities at the bottom of `globals.css` are pre-fork Dorothy
  leftovers, still carrying its teal — unused, and not to be revived.
- **Don't use a gradient.** Lint fails on `bg-gradient`.
- **Don't set a radius inline.** Lint fails on `style={{ borderRadius`. Radius
  comes from the theme: 2px on buttons, inputs, selects, and every `.rounded-*`
  class the app still carries. `rounded-full` survives only on dots and avatars
  under 12px.
- **Don't use a raw Tailwind palette colour.** Lint fails on
  `(text|bg|border)-(red|green|blue|amber|purple|cyan|yellow|orange|zinc|slate|gray)-[0-9]`.
  Use the tokens. Tailwind's `cyan-*` scale is remapped to the tangerine ramp in
  `@theme inline` precisely so old teal classes degrade into the brand instead of
  into a wrong colour.
- **Don't animate for decoration.** Lint fails on `animate-ping`. Motion is
  `fade-in`, `slide-up`, `square-pulse`, and 150ms colour transitions on
  interactive elements. That is the whole vocabulary.
- **Do define appearance only in `src/components/ui/`.** Everything else composes
  those primitives. Run `npm run lint:design` before you push.
- **Do give every data surface all five states**: loading (the three-stage
  ladder), empty, error, needs-sign-in, permission-denied.
- **Do keep the focus ring.** `*:focus-visible` is `2px solid var(--primary)` at
  `outline-offset: 2px`, on both themes. Removing an outline without replacing it
  is not a style choice.
- **Do check both themes.** A token has two values or it isn't a token. The theme
  class is toggled on `<html>`; nothing reads a media query.

## Iconography

[lucide](https://lucide.dev) (`lucide-react`), at 12px (`w-3 h-3`) in dense
controls and 16px (`w-4 h-4`) at standard size, default stroke, coloured with
`text-secondary` or `text-muted` and lifting to `text-primary` on hover. Used in
the frames: `chevron-down` (dropdowns), `check` (selected row), `menu` / `x`
(mobile sidebar), `download` / `external-link` / `rotate-cw` (updater),
`loader-2` (updater only — the app's own waiting state is the square pulse).

**The grey squares in the Pencil exports are placeholders, not a specification.**
Every sidebar entry, settings group, menu row and provider row in
`design/exports/` shows a flat grey square where an icon belongs. They stand for
"an icon goes here"; they are not squares-as-icons and they are not the brand
mark. Pick the lucide glyph that names the thing.

Provider marks are the exception: Claude, Codex, Gemini, Grok and the rest keep
their own logos. `src/components/ProviderBadge.tsx` renders them from one
registry (`src/lib/providers.ts`) at 14px (`w-3.5 h-3.5`) — most as inline SVG
on `currentColor` so they inherit the row's text colour, a few as bitmap assets
from `public/` where the vendor mark is not reducible to a single path.
