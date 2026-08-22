# Tars

![Tars](screenshots/background-2.png)

A beautiful desktop app to orchestrate your [Claude Code](https://claude.ai/code) ,[Codex](https://chatgpt.com/codex), [Gemini](https://geminicli.com/), [Grok](https://x.ai/cli) and local agents. Deploy, monitor, and debug — all from one delightful interface. Free and open source.

![Tars Dashboard](screenshots/0.png)

## Table of Contents

- [Why Tars](#why-tars)
- [Core Features](#core-features)
- [Delegation over ACP](#delegation-over-acp)
- [External Scheduling (Hermes webhook)](#external-scheduling-hermes-webhook)
- [Memory & Brain](#memory--brain)
- [Kanban Task Management](#kanban-task-management)
- [Remote Control](#remote-control)
- [Vault](#vault)
- [SocialData (Twitter/X)](#socialdata-twitterx)
- [Google Workspace](#google-workspace)
- [MCP Servers & Tools](#mcp-servers--tools)
- [Installation](#installation)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Configuration & Storage](#configuration--storage)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

---

## Why Tars

An AI coding CLI runs one agent, in one terminal. Tars runs a team of them, and
does it the same way whichever CLI each one happens to be:

- **Many agents at once**, each in its own PTY, across projects and worktrees
- **Delegation with a receipt** — tasks run over the Agent Client Protocol, so a
  delegated task returns its answer, why the turn ended, the tools it used and
  what it cost, on Claude Code, Codex, Gemini, Grok, opencode or pi alike
- **One memory for all of them** — project notes, session observations, your
  Hermes gateway, gbrain and Honcho, reachable from every CLI
- **Prices and models that stay current** — read from a live catalogue, not from
  a table baked into the release
- **Review and Logs** — what each agent changed, and one search across the fleet
- **Driven by Hermes** — its cron jobs and its kanban board, from here
- **Control from anywhere** — Telegram and Slack for remote management

---

## Core Features

### Parallel Agent Management

Run multiple agents simultaneously, each in its own isolated PTY terminal session. Agents operate independently across different projects, codebases, and tasks.

![Agents View](screenshots/agetns.png)

**Capabilities:**
- Spawn unlimited concurrent agents across multiple projects
- Each agent runs in an isolated terminal with full PTY support
- Assign skills, model selection (sonnet, opus, haiku), and project context per agent
- Send interactive input to any running agent in real-time
- Real-time terminal output streaming per agent
- Agent lifecycle management: `idle` → `running` → `completed` / `error` / `waiting`
- Secondary project paths via `--add-dir` for multi-repo context
- Git worktree support for branch-isolated development
- Persistent agent state across app restarts
- Autonomous execution mode (`--dangerously-skip-permissions`) for unattended operation

### Super Agent (Orchestrator)

A meta-agent that drives the others. Give it a high-level task and it delegates,
monitors and coordinates across your agent pool.

![Super Agent](screenshots/super-agent.png)

- Creates, starts and stops agents through MCP tools
- **Delegates over ACP** — `session/prompt` returns a stop reason, the agent's
  text, its tool calls and the turn's token usage, instead of typing into a
  terminal and hoping. Falls back to terminal dispatch for CLIs with no ACP mode
- **Cannot edit files itself** — file-editing tools are refused through the
  protocol's own permission request, so the rule holds on every CLI rather than
  only where a Claude-specific flag exists
- Scoped to its own project: a call from an agent with no identity is refused
  rather than allowed to reach every project
- Responds to Telegram and Slack for remote orchestration

### Usage Tracking

What your agents cost, per provider and per model.

![Usage Stats](screenshots/stats.png)

Two sources, because no single one covers every CLI. Claude Code writes
transcripts, so its usage is reconstructed from them — deduplicated by message
and request id, because resuming a session copies earlier messages forward and
counting those twice would double every figure. Every other CLI is counted from
the turns it reports back over ACP, which is the only place that usage exists.

Prices come from the live catalogue, so a price change lands without an update.
**Budget & limits** shows each provider the limit it actually has: quota windows
for a subscription, spend against a budget for pay-as-you-go, and nothing at all
for a local model, which is not metered.

### Skills & Plugin System

Extend agent capabilities with skills from [skills.sh](https://skills.sh) and the built-in plugin marketplace.

![Skills Management](screenshots/skills.png)

- **Code Intelligence**: LSP plugins for TypeScript, Python, Rust, Go, and more
- **External Integrations**: GitHub, GitLab, Jira, Figma, Slack, Vercel
- **Development Workflows**: Commit commands, PR review tools
- Install skills per-agent for specialized task handling

### Settings Management

Configure Claude Code settings directly — permissions, environment variables, hooks, and model defaults.

---

### Review

What each agent actually changed: the files it touched with their line counts,
and the patch itself. Compared against the branch the worktree was cut from
rather than against its own remote copy, and untracked files are included —
which is most of what a fresh agent produces.

### Logs

One search across every agent's retained output, attributed to the agent and
branch that produced it. A plain substring works; wrap the query in slashes for
a regex.

### Schedules

Your Hermes cron jobs: every profile in one list, with run-now, pause, resume
and delete. Hermes owns the scheduler — nothing is scheduled here.

---

## Delegation over ACP

Tars speaks the [Agent Client Protocol](https://agentclientprotocol.com) as a
client: JSON-RPC over stdio to an agent subprocess. That is what makes the same
orchestration work across CLIs that share nothing else.

```
initialize                 → protocol version, agent capabilities
session/new  { cwd, mcpServers }   → Tars injects its own MCP servers here
session/set_mode           → who arbitrates permissions
session/prompt             → returns { stopReason, usage }
  ← session/update         → agent_message_chunk, tool_call, plan, usage_update
  ← session/request_permission → Tars answers, so a deny list holds everywhere
```

Launch commands come from the public ACP registry rather than being hardcoded,
and are cached for a day. Providers with no ACP mode fall back to terminal
dispatch, so nothing that worked stops working.

---

## External Scheduling (Hermes webhook)

Tars deliberately has no built-in scheduler. Recurring jobs live in an
external agent (e.g. a self-hosted [Hermes Agent](https://hermes-agent.nousresearch.com/)
instance) whose cron jobs call Tars's webhook to drive agents:

```
POST http://<dorothy-host>:31415/api/webhooks/hermes
Authorization: Bearer <contents of ~/.dorothy/api-token>
{
  "agent_name": "QA — myproject",   // or "agent_id"
  "project_path": "/path/to/project", // narrows agent_name when ambiguous
  "message": "Run the full test suite and report failures",
  "model": "claude-sonnet-5",         // optional
  "permission_mode": "auto"           // optional
}
```

The webhook shares the atomic dispatch used internally: it messages a live
session or spawns a fresh one, and refuses (409) when the agent is blocked
on a permission dialog. Poll `GET /api/agents/:id` for status/output.

If the scheduler runs on another machine (a VPS), expose the localhost-bound
API with a tunnel, e.g. `tailscale serve 31415` on the Tars machine.

## Memory & Brain

One memory, five sources, reachable from every CLI — not just the ones that
share Claude's config directory.

| Source | What it is | How agents reach it |
|---|---|---|
| Project memory | `~/.claude/projects/*/memory/*.md` | digest at session start, `memory_read` |
| Session observations | per-project ledger in `~/.dorothy/observations/` | digest at session start |
| Hermes memory | the gateway's own `MEMORY.md` / `USER.md`, plus full-text search over every past session | `memory_search` |
| gbrain | shared semantic memory over MCP | `memory_search` |
| Honcho | Plastic Labs' memory layer over MCP | `memory_search` |

Hermes exposes no HTTP API for memory *content* — `/api/memory` only administers
which provider is active — so the files come through `/api/files/read` and recall
through `/api/sessions/search`, which is what its own dashboard does.

Reaching all of it is provider-agnostic twice over:

- **`tars-memory`**, a bundled MCP server registered with *every* provider's own
  config (`~/.claude.json`, `~/.codex/config.toml`, `~/.gemini/settings.json`,
  `~/.grok/config.toml`, `~/.opencode/config.json`, `~/.pi/config.json`), exposing
  `memory_search`, `memory_read`, `memory_write` and `memory_sources`
- **prompt injection** for the CLIs that have no session-start hook, so they
  cannot begin blind even if they never call a tool

The Brain page contacts each source when you open it: *reachable* means something
answered, and it lists the tools each backend offers.

## Kanban Task Management

A task board integrated with the agent system. Tasks flow through columns and can be automatically assigned to agents based on skill matching.

![Kanban Board](screenshots/kanban.png)

### Workflow

```
Backlog → Planned → Ongoing → Done
```

- **Priority levels**: Low, Medium, High
- **Progress tracking**: 0-100% per task
- **Agent assignment**: Assign tasks to specific agents or let the system auto-assign
- **Labels and tags**: Organize and filter tasks
- **Skill requirements**: Define required skills — the system matches tasks to capable agents

### Automatic Agent Assignment

The `kanban-automation` service continuously watches for new tasks and:

1. Matches task skill requirements against available agents
2. Creates new agents if no matching agent exists
3. Assigns the task and moves it to `ongoing`
4. Tracks progress as the agent works
5. Marks the task `done` when the agent completes

This enables a **self-managing task pipeline** — add tasks to the backlog and agents automatically pick them up.

---

## Remote Control

### Telegram Integration

Control your entire agent fleet from Telegram. Start agents, check status, delegate tasks to the Super Agent — all from your phone.

| Command | Description |
|---------|-------------|
| `/status` | Overview of all agents and their states |
| `/agents` | Detailed agent list with current tasks |
| `/projects` | List all projects with their agents |
| `/start_agent <name> <task>` | Spawn and start an agent with a task |
| `/stop_agent <name>` | Stop a running agent |
| `/ask <message>` | Delegate a task to the Super Agent |
| `/usage` | API usage and cost statistics |
| `/help` | Command reference |

Send any message without a command to talk directly to the Super Agent.

**Media support** via the `mcp-telegram` server: send photos, videos, and documents.

**Setup:**
1. Create a bot via [@BotFather](https://t.me/botfather) and copy the token
2. Paste the bot token in **Settings**
3. Send `/start` to your bot to register your chat ID
4. Multiple users can authorize by sending `/start`

### Slack Integration

Same capabilities as Telegram, accessible via @mentions or direct messages.

| Command | Description |
|---------|-------------|
| `status` | Overview of all agents |
| `agents` | Detailed agent list |
| `projects` | List projects with agents |
| `start <name> <task>` | Spawn and start an agent |
| `stop <name>` | Stop a running agent |
| `usage` | API usage and cost statistics |
| `help` | Command reference |

**Features:** @mentions in channels, DMs, Socket Mode (no public URL), thread-aware responses.

**Setup:**
1. Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From scratch**
2. Name it "Tars" and select your workspace
3. **Socket Mode** → Enable → Generate App Token with scope `connections:write` (`xapp-...`)
4. **OAuth & Permissions** → Add scopes: `app_mentions:read`, `chat:write`, `im:history`, `im:read`, `im:write`
5. **Install to Workspace** → Copy Bot Token (`xoxb-...`)
6. **Event Subscriptions** → Enable → Subscribe to: `app_mention`, `message.im`
7. **App Home** → Enable "Messages Tab"
8. Paste both tokens in **Settings → Slack** and enable

---

## Vault

A persistent document storage system that agents can read, write, and search across sessions. Use it as a shared knowledge base — agents store reports, analyses, research findings, and structured notes that any other agent can access later.

![Vault](screenshots/vault.png)

### Features

- **Markdown documents** with title, content, tags, and file attachments
- **Folder organization** with nested hierarchies (auto-created on document creation)
- **Full-text search** powered by SQLite FTS5 — search across titles, content, and tags
- **Cross-agent access** — any agent can read documents created by another
- **File attachments** — attach files to documents for reference

### MCP Tools

| Tool | Parameters | Description |
|------|-----------|-------------|
| `vault_create_document` | `title`, `content`, `folder`, `tags?` | Create a document (auto-creates folder if needed) |
| `vault_update_document` | `document_id`, `title?`, `content?`, `tags?`, `folder_id?` | Update an existing document |
| `vault_get_document` | `document_id` | Read a document with full content and metadata |
| `vault_list_documents` | `folder_id?`, `tags?` | List documents, optionally filtered by folder or tags |
| `vault_delete_document` | `document_id` | Delete a document |
| `vault_attach_file` | `document_id`, `file_path` | Attach a file to a document |
| `vault_search` | `query`, `limit?` | Full-text search (supports AND, OR, NOT, phrase matching) |
| `vault_create_folder` | `name`, `parent_id?` | Create a folder (supports nesting) |
| `vault_list_folders` | — | List all folders as a tree |
| `vault_delete_folder` | `folder_id`, `recursive?` | Delete a folder (optionally with all contents) |

---

## SocialData (Twitter/X)

Search tweets, get user profiles, and retrieve engagement data via the [SocialData API](https://socialdata.tools). Useful for social media research, monitoring, and analysis tasks.

### Setup

1. Get an API key from [socialdata.tools](https://socialdata.tools)
2. Paste it in **Settings → SocialData API Key**

### MCP Tools

| Tool | Parameters | Description |
|------|-----------|-------------|
| `twitter_search` | `query`, `type?`, `cursor?` | Search tweets with advanced operators (`from:`, `min_faves:`, `filter:images`, etc.) |
| `twitter_get_tweet` | `tweet_id` | Get full tweet details with engagement metrics |
| `twitter_get_tweet_comments` | `tweet_id`, `cursor?` | Get replies/comments on a tweet |
| `twitter_get_user` | `username` | Get a user's profile (bio, followers, stats) |
| `twitter_get_user_tweets` | `user_id`, `include_replies?`, `cursor?` | Get recent tweets from a user |

All tools support cursor-based pagination for large result sets.

---

## Google Workspace

Access Gmail, Drive, Sheets, Docs, Calendar, and more directly from your agents via the [Google Workspace CLI](https://github.com/googleworkspace/cli) (`gws`). Tars integrates `gws` as an MCP server so agents can read emails, manage files, create documents, and interact with Google APIs.

### Setup

1. Install **gcloud CLI** — required for OAuth setup (`brew install google-cloud-sdk`)
2. Install **gws CLI** — `npm install -g @googleworkspace/cli`
3. Open **Settings → Google Workspace** and follow the guided setup:
   - Click **Auth Setup** to create a Google Cloud project and OAuth client
   - Click **Auth Login** to authenticate with your Google account
   - Enable the toggle to register the MCP server with your agents
4. Optionally install **Agent Skills** for 100+ specialized Google Workspace skills

### Features

- **MCP server**: Runs `gws mcp` over stdio, exposing Google APIs as tools (10-80 tools per service)
- **Multi-provider**: MCP server registered with all configured providers (Claude, Codex, Gemini, Grok)
- **Service badges**: Settings page shows connected services with per-service access levels (READ / R/W)
- **Agent skills**: Detects and lists installed `gws-*` skills (e.g., `gws-gmail`, `gws-drive`, `gws-calendar`)
- **Update Access**: Re-run `gws auth login` to add or change OAuth scopes without re-running setup

### Default Services

| Service | Scope | Description |
|---------|-------|-------------|
| **Gmail** | Read/Write | Send, read, and manage email |
| **Drive** | Read/Write | Manage files, folders, and shared drives |
| **Sheets** | Read/Write | Read and write spreadsheets |
| **Calendar** | Read/Write | Manage calendars and events |
| **Docs** | Read/Write | Read and write documents |

Additional services (Slides, Tasks, Chat, People, Forms, Keep) are available based on OAuth scopes.

---

## MCP Servers & Tools

Tars bundles **seven MCP servers**. They are registered automatically with every
provider Tars can run, not only with Claude Code, so an agent on Codex or Gemini
gets the same toolbelt.

### mcp-orchestrator

The main orchestration server — agent management and messaging.

#### Agent Management Tools

| Tool | Parameters | Description |
|------|-----------|-------------|
| `list_agents` | — | List all agents with status, ID, name, project, and current task |
| `get_agent` | `id` | Get detailed info about a specific agent including output history |
| `get_agent_output` | `id`, `lines?` (default: 100) | Read an agent's recent terminal output |
| `create_agent` | `projectPath`, `name?`, `skills?`, `character?`, `skipPermissions?` (default: true), `secondaryProjectPath?` | Create a new agent in idle state |
| `start_agent` | `id`, `prompt`, `model?` | Start an agent with a task (or send message if already running) |
| `send_message` | `id`, `message` | Send input to a running agent (auto-starts idle agents) |
| `stop_agent` | `id` | Terminate a running agent (returns to idle) |
| `remove_agent` | `id` | Permanently delete an agent |
| `wait_for_agent` | `id`, `timeoutSeconds?` (300), `pollIntervalSeconds?` (5) | Poll agent until completion, error, or waiting state |

#### Messaging Tools

| Tool | Parameters | Description |
|------|-----------|-------------|
| `send_telegram` | `message` | Send a text message to Telegram (truncates at 4096 chars) |
| `send_slack` | `message` | Send a text message to Slack (truncates at 4000 chars) |

### mcp-telegram

Standalone MCP server for Telegram messaging with media support.

| Tool | Parameters | Description |
|------|-----------|-------------|
| `send_telegram` | `message`, `chat_id?` | Send a text message |
| `send_telegram_photo` | `photo_path`, `chat_id?`, `caption?` | Send a photo/image |
| `send_telegram_video` | `video_path`, `chat_id?`, `caption?` | Send a video |
| `send_telegram_document` | `document_path`, `chat_id?`, `caption?` | Send a document/file |

Direct HTTPS API calls. File uploads via multipart form data. Markdown formatting support.

---

### mcp-kanban

MCP server for programmatic Kanban task management.

| Tool | Parameters | Description |
|------|-----------|-------------|
| `list_tasks` | `column?`, `assigned_to_me?` | List tasks, filter by column or assignment |
| `get_task` | `task_id` (prefix matching) | Get full task details |
| `create_task` | `title`, `description`, `project_path?`, `priority?`, `labels?` | Create a task in backlog |
| `move_task` | `task_id`, `column` | Move task between columns |
| `update_task_progress` | `task_id`, `progress` (0-100) | Update progress |
| `mark_task_done` | `task_id`, `summary` | Complete a task with summary |
| `assign_task` | `task_id`, `agent_id?` | Assign task to an agent |
| `delete_task` | `task_id` | Remove a task |

**Columns:** `backlog` → `planned` → `ongoing` → `done`

---

### mcp-vault

MCP server for persistent document management. See [Vault](#vault) for full tool reference.

---

### mcp-socialdata

MCP server for Twitter/X data via the SocialData API. See [SocialData (Twitter/X)](#socialdata-twitterx) for full tool reference.

---

## Installation

### Prerequisites

- **Node.js** 18+
- **npm** or yarn
- **Claude Code CLI**: `npm install -g @anthropic-ai/claude-code`
- **GitHub CLI** (`gh`) — used by agents for GitHub operations

### Download

Download the latest release from [GitHub Releases](https://github.com/Charlie85270/Tars/releases).

> **macOS:** If "app is damaged", run `xattr -cr /Applications/Tars.app`

### Build from Source

```bash
git clone https://github.com/Charlie85270/Tars.git
cd Tars/app/tars
npm install
npx @electron/rebuild        # Rebuild native modules for Electron
npm run electron:dev          # Development mode
npm run electron:build        # Production build (DMG)
```

Output in `release/`:
- **macOS**: `release/mac-arm64/Tars.app` (Apple Silicon) or `release/mac/Tars.app` (Intel)
- DMG installer included

### Web Browser (Development)

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Agent management and terminal features require the Electron app.

---

## Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────┐
│                     Electron App                          │
│                                                           │
│  ┌───────────────────┐  ┌──────────────────────────────┐ │
│  │  React / Next.js   │  │   Electron Main Process      │ │
│  │  (Renderer)        │←→│                               │ │
│  │                    │  │  ┌──────────────────────────┐ │ │
│  │  - Agent Dashboard │  │  │  Agent Manager           │ │ │
│  │  - Kanban Board    │  │  │  (node-pty, N parallel)  │ │ │
│  │  - Brain (memory)  │  │  ├──────────────────────────┤ │ │
│  │  - Extensions      │  │  │  PTY Manager             │ │ │
│  │  - Usage Stats     │  │  │  (terminal multiplexing) │ │ │
│  │  - Skills/Plugins  │  │  ├──────────────────────────┤ │ │
│  │  - Settings        │  │  │  Services:               │ │ │
│  │                    │  │  │  - Telegram Bot           │ │ │
│  └───────────────────┘  │  │  - Slack Bot              │ │ │
│          ↕ IPC           │  │  - Kanban Automation      │ │ │
│  ┌───────────────────┐  │  │  - MCP Server Launcher    │ │ │
│  │  API Routes        │  │  │  - API Server             │ │ │
│  │  (Next.js)         │←→│  └──────────────────────────┘ │ │
│  └───────────────────┘  └──────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
           ↕ stdio                     ↕ stdio
┌──────────────────┐ ┌──────────────┐ ┌──────────────┐
│ mcp-orchestrator │ │ mcp-telegram │ │  mcp-kanban  │
│   (26+ tools)    │ │  (4 tools)   │ │  (8 tools)   │
└──────────────────┘ └──────────────┘ └──────────────┘
┌──────────────────┐ ┌──────────────┐
│    mcp-vault     │ │mcp-socialdata│
│   (10 tools)     │ │  (5 tools)   │
└──────────────────┘ └──────────────┘
```

### Data Flow: Parallel Agent Execution

1. User (or Super Agent) creates agent → API route → Agent Manager
2. Agent Manager spawns `claude` CLI process via node-pty (one per agent)
3. Multiple agents run concurrently, each in an isolated PTY session
4. Output streamed in real-time to the renderer via IPC
5. Status detected by parsing output patterns (running/waiting/completed/error)
6. Services notified (Telegram, Slack, Kanban) on status changes
7. Agent state persisted to `~/.dorothy/agents.json`

### MCP Communication

All MCP servers communicate via **stdio** (standard input/output):

```
Claude Code ←→ stdio ←→ MCP Server
                         ├── Tool handlers (Zod-validated schemas)
                         └── @modelcontextprotocol/sdk
```

---

## Project Structure

```
tars/
├── src/                           # Next.js frontend (React)
│   ├── app/                       # Page routes
│   │   ├── agents/                # Agent management UI (+ templates, teams)
│   │   ├── kanban/                # Kanban board UI
│   │   ├── settings/              # Settings page
│   │   ├── skills/                # Extensions (skills + plugins)
│   │   ├── usage/                 # Usage statistics
│   │   ├── projects/              # Projects overview
│   │   └── api/                   # Backend API routes
│   ├── components/                # React components
│   ├── hooks/                     # Custom React hooks
│   ├── lib/                       # Utility functions
│   ├── store/                     # Zustand state management
│   └── types/                     # TypeScript type definitions
├── electron/                      # Electron main process
│   ├── main.ts                    # Entry point
│   ├── preload.ts                 # Preload script
│   ├── core/
│   │   ├── agent-manager.ts       # Agent lifecycle & parallel execution
│   │   ├── pty-manager.ts         # Terminal session multiplexing
│   │   └── window-manager.ts      # Window management
│   ├── services/
│   │   ├── telegram-bot.ts        # Telegram bot integration
│   │   ├── slack-bot.ts           # Slack bot integration
│   │   ├── api-server.ts          # HTTP API server
│   │   ├── mcp-orchestrator.ts    # MCP server launcher
│   │   ├── claude-service.ts      # Claude Code CLI integration
│   │   ├── hooks-manager.ts       # Git hooks management
│   │   └── kanban-automation.ts   # Task → Agent auto-assignment
│   ├── handlers/                  # IPC handlers
│   │   ├── ipc-handlers.ts       # Agent, skill, plugin IPC
│   │   └── gws-handlers.ts       # Google Workspace integration
├── mcp-orchestrator/              # MCP server (orchestration)
│   └── src/tools/
│       ├── agents.ts              # Agent management tools (9)
│       ├── messaging.ts           # Telegram/Slack tools (2)
│       └── messaging.ts           # Telegram/Slack tools
├── mcp-telegram/                  # MCP server (Telegram media)
│   └── src/index.ts               # Text, photo, video, document (4)
├── mcp-kanban/                    # MCP server (task management)
│   └── src/index.ts               # Kanban CRUD tools (8)
├── mcp-vault/                     # MCP server (document management)
│   └── src/index.ts               # Vault CRUD + search tools (10)
├── mcp-socialdata/                # MCP server (Twitter/X data)
│   └── src/index.ts               # Twitter search + user tools (5)
└── landing/                       # Marketing landing page
```

---

## Tech Stack

| Category | Technology | Version |
|----------|-----------|---------|
| **Framework** | Next.js (App Router) | 16 |
| **Frontend** | React | 19 |
| **Desktop** | Electron | 33 |
| **Styling** | Tailwind CSS | 4 |
| **State** | Zustand | 5 |
| **Animations** | Framer Motion | 12 |
| **Terminal** | xterm.js + node-pty | 5 / 1.1 |
| **Database** | better-sqlite3 | 11 |
| **MCP** | @modelcontextprotocol/sdk | 1.0 |
| **Telegram** | node-telegram-bot-api | 0.67 |
| **Slack** | @slack/bolt | 4.0 |
| **Validation** | Zod | 3.22 |
| **Language** | TypeScript | 5 |

---

## Configuration & Storage

### Configuration Files

| File | Description |
|------|-------------|
| `~/.dorothy/app-settings.json` | App settings (Telegram token, Slack tokens, preferences) |
| `~/.dorothy/cli-paths.json` | CLI tool paths for agents |
| `~/.claude/settings.json` | Claude Code user settings |

### Data Files

| File | Description |
|------|-------------|
| `~/.dorothy/agents.json` | Persisted agents. Versioned, written atomically through a temp file and rename; a corrupt copy is kept as `.corrupt` rather than replaced |
| `~/.dorothy/agents.backup.json` | Last copy that parsed successfully |
| `~/.dorothy/projects.json` | Folders you added, so an update never loses them |
| `~/.dorothy/kanban-tasks.json` | Local kanban board (the Hermes board lives in the gateway) |
| `~/.dorothy/team-templates.json` | Team templates |
| `~/.dorothy/observations/` | Per-project activity ledgers |
| `~/.dorothy/usage-ledger.jsonl` | Per-turn tokens and cost, for the CLIs that write no transcript |
| `~/.dorothy/model-catalog.json` | Cached model + price catalogue, with its ETag |
| `~/.dorothy/acp-registry.json` | Cached ACP launch commands |
| `~/.dorothy/hermes-connection.json` | Gateway mode, URL and token |
| `~/.dorothy/vault.db` | Vault documents, folders and FTS index (SQLite) |

### Generated Files

| Location | Description |
|----------|-------------|
| `~/.dorothy/scripts/` | Generated task runner scripts |
| `~/.claude/logs/` | Task execution logs |

---

## Development

### Scripts

```bash
npm run dev              # Next.js dev server
npm run electron:dev     # Electron + Next.js concurrent dev mode
npm run build            # Next.js production build
npm run electron:build   # Distributable app (DMG)
npm run electron:pack    # Directory package, for testing a real build
npm run sandbox          # A second instance with its own HOME, beside your real one
npm run lint             # ESLint
npm run lint:design      # Design guardrails (radius, shadows, gradients, palette)
npm run e2e              # Playwright drives the real Electron app, 35 surfaces
npm run e2e:update       # Re-record the visual baselines
npm run e2e:guard        # Fail if a surface in design/UI-INVENTORY.md is uncovered
```

### Build Pipeline

1. Next.js production build (API routes moved aside — the packaged app has no server)
2. TypeScript compilation for the Electron main process
3. The seven MCP servers built independently and copied into `extraResources`
4. `electron-builder` packages into a distributable

### Design

`design/tars.pen` holds every surface as a Pencil frame — pages, all seventeen
settings sections, overlays, menus, control states, the launch sequence and the
loading stages. `design/UI-INVENTORY.md` is the checklist the E2E guard reads.

### Environment

The app reads Claude Code configuration from:
- `~/.claude/settings.json` — User settings
- `~/.claude/statsig_metadata.json` — Usage statistics
- `~/.claude/projects/` — Project-specific data

---

## Contributing

Contributions are welcome. Please submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## License

This project is open source and available under the [MIT License](LICENSE).

## Acknowledgments

- [Anthropic](https://anthropic.com) for Claude Code
- [skills.sh](https://skills.sh) for the skills ecosystem
