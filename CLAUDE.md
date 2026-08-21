## Memory System

Dorothy exposes Claude Code's **native memory** (`~/.claude/projects/*/memory/`) via the Memory page. No custom storage — reads real Claude Code memory files. Project dir names use path-as-folder-name encoding (slashes → dashes).

## Memory

Use auto memory (`~/.claude/projects/.../memory/`) actively on this project:
- Save architectural decisions, key file locations, and debugging insights to `MEMORY.md`
- Create topic files (e.g. `patterns.md`, `debugging.md`) for detailed notes — keep `MEMORY.md` under 200 lines
- At session start, review `MEMORY.md` for relevant context before diving in
- After any correction or new discovery, update memory so the next session benefits

## Autonomy

When you are delegated a task by Dorothy or an orchestrator agent, **always act autonomously**:
- Do NOT ask for confirmation before proceeding — just do the work and report results
- Do NOT ask "Would you like me to continue?" or "Shall I proceed?" — the answer is always yes
- If a task is ambiguous, make reasonable assumptions and state them in your report
- Complete the full task and return your findings/output directly

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
