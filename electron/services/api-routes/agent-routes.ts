import * as path from 'path';
import * as fs from 'fs';
import * as pty from 'node-pty';
import { app } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { agents, saveAgents, killStalePty, ensureProjectTrusted } from '../../core/agent-manager';
import { ptyProcesses, writeProgrammaticInput } from '../../core/pty-manager';
import { buildFullPath } from '../../utils/path-builder';
import { AgentStatus, AgentCharacter } from '../../types';
import { RouteApp, RouteContext, RouteRequest, SendJson } from './types';

type SpawnOpts = {
  model?: string;
  permissionMode?: 'normal' | 'auto' | 'bypass';
  printMode?: boolean;
};

/**
 * Spawn a fresh one-shot claude PTY for `agent` with `prompt` as the task.
 *
 * Shared by /start, the /message reconnect path, and /dispatch so every entry
 * point gets identical behavior: skills prefix, MCP config for orchestrators,
 * model flag, orchestrator tool restrictions (BUG 5), trust pre-acceptance
 * (BUG 6), stale-PTY kill and ptyCwd invariant (BUG 4), and session-ownership
 * reset so hooks of the killed session can't flip the new task's status.
 *
 * Returns false if validation failed — an error response has already been sent.
 */
function spawnAgentSession(
  agent: AgentStatus,
  prompt: string,
  opts: SpawnOpts,
  ctx: RouteContext,
  sendJson: SendJson
): boolean {
  // Raw cwd for pty.spawn, shell-escaped form for the `cd` command. These
  // must be separate — passing the shell-escaped form to pty.spawn would
  // break when the path legitimately contains a single quote.
  const rawWorkingDir = agent.worktreePath || agent.projectPath;
  const workingDir = rawWorkingDir.replace(/'/g, "'\\''");
  let command = `cd '${workingDir}' && claude`;

  const isAutomationAgent = agent.name?.toLowerCase().includes('automation:');
  const usePrintMode = opts.printMode || isAutomationAgent;

  if (usePrintMode) {
    command += ' -p';
  }

  const isSuperAgentApi = agent.role === 'orchestrator' ||
                          agent.name?.toLowerCase().includes('super agent') ||
                          agent.name?.toLowerCase().includes('orchestrator');

  if (isSuperAgentApi || isAutomationAgent) {
    const mcpConfigPath = path.join(app.getPath('home'), '.claude', 'mcp.json');
    if (fs.existsSync(mcpConfigPath)) {
      command += ` --mcp-config '${mcpConfigPath}'`;
    }
  }

  if (agent.secondaryProjectPath) {
    command += ` --add-dir '${agent.secondaryProjectPath.replace(/'/g, "'\\''")}'`;
  }
  const effectiveMode = opts.permissionMode ?? agent.permissionMode ?? (agent.skipPermissions ? 'auto' : 'normal');
  if (effectiveMode === 'auto' || effectiveMode === 'bypass') {
    command += ' --dangerously-skip-permissions';
  }
  // BUG 5: orchestrator-mode agents cannot edit files directly — must delegate.
  if (isSuperAgentApi || agent.orchestratorMode) {
    command += ' --disallowed-tools "Edit" "Write" "MultiEdit" "NotebookEdit"';
  }
  const resolvedModel = opts.model || agent.model;
  // 'default' is a Dorothy UI alias meaning "let Claude CLI pick"; omit the flag.
  if (resolvedModel && resolvedModel !== 'default') {
    // Allow the same characters as claude-provider.ts buildInteractiveCommand,
    // including brackets used by 1M-context variants (e.g. sonnet[1m]).
    if (!/^[a-zA-Z0-9._:\/\[\]-]+$/.test(resolvedModel)) {
      sendJson({ error: 'Invalid model name' }, 400);
      return false;
    }
    command += ` --model '${resolvedModel}'`;
  }

  // Load ~/.dorothy/CLAUDE.md (autonomy rules) exactly like UI-spawned agents
  // do — without it, delegated agents ask for confirmations and get stuck in
  // 'waiting' inside a hidden PTY.
  const dorothyDir = path.join(app.getPath('home'), '.dorothy');
  if (fs.existsSync(dorothyDir)) {
    command += ` --add-dir '${dorothyDir.replace(/'/g, "'\\''")}'`;
  }

  let finalPrompt = prompt;
  if (agent.skills && agent.skills.length > 0 && !isSuperAgentApi) {
    const skillsList = agent.skills.join(', ');
    finalPrompt = `[IMPORTANT: Use these skills for this session: ${skillsList}. Invoke them with /<skill-name> when relevant to the task.] ${prompt}`;
  }
  // Identity header: agents must know who they are without the orchestrator
  // having to explain it in every delegation ("les agents ne comprennent pas
  // qui ils sont"). The SessionStart bootstrap injection adds the full team
  // roster; this header guarantees the essentials even if hooks are absent.
  const identityHeader =
    `[Dorothy: you are agent "${agent.name || agent.id}" (id ${agent.id}), ` +
    `${agent.role || 'worker'} of project ${agent.projectPath}` +
    (agent.worktreePath
      ? `, working in worktree ${agent.worktreePath}${agent.branchName ? ` (branch ${agent.branchName})` : ''} — stay inside this directory`
      : '') +
    `. Work autonomously without asking for confirmation and end with a clear report of your results` +
    (isSuperAgentApi ? '' : ' — an orchestrator reads your final message') +
    `.]`;
  finalPrompt = `${identityHeader}\n\n${finalPrompt}`;
  command += ` '${finalPrompt.replace(/'/g, "'\\''")}'`;

  const shell = '/bin/bash';
  const fullPath = buildFullPath();

  // Kill any existing PTY for this agent before spawning a new one.
  // Agents started via the API use one-shot PTYs that stay alive (the claude
  // process waits at a prompt after each task). Without this, every dispatch
  // orphans the previous PTY+claude process, eventually exhausting resources.
  if (agent.ptyId) {
    const existingPty = ptyProcesses.get(agent.ptyId);
    if (existingPty) {
      existingPty.kill();
      ptyProcesses.delete(agent.ptyId);
    }
  }

  // BUG 6: pre-accept Claude Code's workspace trust dialog for this cwd.
  ensureProjectTrusted(rawWorkingDir);

  const ptyProcess = pty.spawn(shell, ['-l', '-c', command], {
    name: 'xterm-256color',
    cols: 120,
    rows: 40,
    cwd: rawWorkingDir,
    env: {
      ...process.env,
      PATH: fullPath,
      TERM: 'xterm-256color',
      CLAUDE_SKILLS: agent.skills?.join(',') || '',
      CLAUDE_AGENT_ID: agent.id,
      CLAUDE_PROJECT_PATH: agent.projectPath,
      // Load CLAUDE.md from --add-dir directories (e.g. ~/.dorothy)
      CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD: '1',
    },
  });

  const ptyId = uuidv4();
  ptyProcesses.set(ptyId, ptyProcess);

  agent.ptyId = ptyId;
  agent.ptyCwd = rawWorkingDir;
  agent.status = 'running';
  agent.currentTask = prompt;
  agent.output = [];
  agent.lastCleanOutput = undefined;  // Clear stale output from previous task
  agent.error = undefined;            // Clear previous error state
  agent.waitingReason = undefined;
  // The old session (if any) died with its PTY. The fresh claude session
  // re-registers itself via the SessionStart hook; clearing now lets the
  // hooks-routes stale-session guard reject in-flight posts from the killed
  // session that would otherwise flip this new task's status.
  agent.currentSessionId = undefined;
  agent.lastActivity = new Date().toISOString();
  saveAgents();

  ptyProcess.onData((data: string) => {
    agent.output.push(data);
    if (agent.output.length > 10000) {
      agent.output = agent.output.slice(-5000);
    }
    agent.lastActivity = new Date().toISOString();

    if (ctx.mainWindow && !ctx.mainWindow.isDestroyed()) {
      ctx.mainWindow.webContents.send('agent:output', { agentId: agent.id, data });
    }
  });

  ptyProcess.onExit(({ exitCode }) => {
    // Delay status change to let hooks (on-stop.sh, task-completed.sh) finish
    // capturing output before wait_for_agent resolves.
    setTimeout(() => {
      // Guard: only mutate if this PTY is still the active one — a newer
      // dispatch may have replaced it during the delay.
      if (agent.ptyId !== ptyId) {
        ptyProcesses.delete(ptyId);
        return;
      }
      if (agent.status === 'running') {
        agent.status = exitCode === 0 ? 'completed' : 'error';
      } else if (agent.status === 'waiting') {
        // PTY exited while agent was waiting for input — the claude process
        // crashed. Mark as error so /wait is unblocked and the orchestrator
        // can retry rather than hanging until timeout.
        agent.status = 'error';
        agent.waitingReason = undefined;
      }
      if (exitCode !== 0) {
        agent.error = `Process exited with code ${exitCode}`;
      }
      agent.lastActivity = new Date().toISOString();
      ptyProcesses.delete(ptyId);
      saveAgents();
      ctx.agentStatusEmitter.emit(`status:${agent.id}`);
    }, 1500);
  });

  return true;
}

/** Serializable agent projection for API responses — excludes the raw ANSI
 *  `output` buffer (up to 10 000 chunks), which destroys LLM context windows
 *  when returned to MCP callers. Use /output or ?full=true when needed. */
function projectAgent(agent: AgentStatus) {
  const { output, ...rest } = agent;
  return { ...rest, outputChunks: output.length };
}

/** Project path of the calling agent, injected as a header by the MCP client
 *  from its PTY environment. Absent for the UI and other local callers. */
function callerProject(req: RouteRequest): string | undefined {
  const h = req.raw?.headers?.['x-dorothy-caller-project'];
  return typeof h === 'string' && h.length > 0 ? h : undefined;
}

/**
 * Cross-project guard: an orchestrator may only act on agents of its own
 * project. This is what stops an orchestrator from delegating to another
 * project's agents when the LLM picks a wrong ID from a global listing.
 * Callers without identity headers (UI, curl) are unrestricted, and a caller
 * can explicitly override with allowCrossProject: true.
 */
function assertSameProject(req: RouteRequest, agent: AgentStatus, sendJson: SendJson): boolean {
  const caller = callerProject(req);
  if (!caller || agent.projectPath === caller) return true;
  if ((req.body as { allowCrossProject?: boolean } | undefined)?.allowCrossProject === true) return true;
  sendJson({
    error: `Cross-project access denied: agent "${agent.name || agent.id}" belongs to project ${agent.projectPath}, but you are the orchestrator of ${caller}. Use list_agents to see YOUR project's agents, or pass allowCrossProject: true if this is intentional.`,
  }, 403);
  return false;
}

export function registerAgentRoutes(app_: RouteApp, ctx: RouteContext): void {
  // GET /api/agents/:id/wait — long-poll until agent status changes
  app_.get(/^\/api\/agents\/([^/]+)\/wait$/, (req, sendJson) => {
    const agent = agents.get(req.params.id);
    if (!agent) {
      sendJson({ error: 'Agent not found' }, 404);
      return;
    }

    const timeoutSec = parseInt(req.url.searchParams.get('timeout') || '300', 10);
    const currentStatus = agent.status;

    // Return immediately if already in terminal state
    if (currentStatus === 'completed' || currentStatus === 'error' || currentStatus === 'idle' || currentStatus === 'waiting') {
      sendJson({
        status: agent.status,
        lastCleanOutput: agent.lastCleanOutput,
        error: agent.error,
        waitingReason: agent.waitingReason,
      });
      return;
    }

    // Long-poll: wait for status change event
    const agentId = req.params.id;
    let resolved = false;

    const respond = () => {
      if (resolved) return;
      resolved = true;
      const a = agents.get(agentId);
      sendJson({
        status: a?.status || 'idle',
        lastCleanOutput: a?.lastCleanOutput,
        error: a?.error,
        waitingReason: a?.waitingReason,
      });
    };

    const onStatusChange = () => respond();
    ctx.agentStatusEmitter.on(`status:${agentId}`, onStatusChange);

    const timeout = setTimeout(() => {
      ctx.agentStatusEmitter.off(`status:${agentId}`, onStatusChange);
      if (!resolved) {
        resolved = true;
        const a = agents.get(agentId);
        sendJson({
          status: a?.status || 'running',
          lastCleanOutput: a?.lastCleanOutput,
          timeout: true,
        });
      }
    }, timeoutSec * 1000);

    // Clean up if client disconnects
    req.raw.on('close', () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        ctx.agentStatusEmitter.off(`status:${agentId}`, onStatusChange);
      }
    });
  });

  // GET /api/agents — scoped to the caller's project by default (?all=true
  // for the global view). An orchestrator that only ever SEES its own team
  // cannot pick another project's agent ID by mistake.
  app_.get('/api/agents', (req, sendJson) => {
    const caller = callerProject(req);
    const showAll = req.url.searchParams.get('all') === 'true';
    let agentValues = Array.from(agents.values());
    if (caller && !showAll) {
      agentValues = agentValues.filter(a => a.projectPath === caller);
    }
    const agentList = agentValues.map(a => ({
      id: a.id,
      name: a.name,
      status: a.status,
      projectPath: a.projectPath,
      secondaryProjectPath: a.secondaryProjectPath,
      skills: a.skills,
      currentTask: a.currentTask,
      lastActivity: a.lastActivity,
      character: a.character,
      branchName: a.branchName,
      role: a.role,
      error: a.error,
    }));
    sendJson({ agents: agentList, scopedToProject: caller && !showAll ? caller : undefined });
  });

  // GET /api/agents/:id
  app_.get(/^\/api\/agents\/([^/]+)$/, (req, sendJson) => {
    const agent = agents.get(req.params.id);
    if (!agent) {
      sendJson({ error: 'Agent not found' }, 404);
      return;
    }
    const full = req.url.searchParams.get('full') === 'true';
    sendJson({ agent: full ? agent : projectAgent(agent) });
  });

  // GET /api/agents/:id/bootstrap — identity + team roster context, injected
  // into every fresh claude session by session-start.sh. This is what makes
  // the "who am I / who is my team" handshake automatic instead of a manual
  // ritual at the start of every working session.
  app_.get(/^\/api\/agents\/([^/]+)\/bootstrap$/, (req, sendJson) => {
    const agent = agents.get(req.params.id);
    if (!agent) {
      sendJson({ error: 'Agent not found' }, 404);
      return;
    }

    const isOrchestrator = agent.role === 'orchestrator' ||
                           agent.name?.toLowerCase().includes('super agent') ||
                           agent.name?.toLowerCase().includes('orchestrator');

    const teammates = Array.from(agents.values())
      .filter(a => a.projectPath === agent.projectPath && a.id !== agent.id)
      .map(a => `- "${a.name || a.id}" (id: ${a.id}) — ${a.role || 'worker'}, status: ${a.status}` +
                (a.branchName ? `, branch: ${a.branchName}` : '') +
                (a.skills?.length ? `, skills: ${a.skills.join(', ')}` : ''));

    const lines = [
      `# Dorothy agent identity`,
      ``,
      `You are "${agent.name || agent.id}" (agent id: ${agent.id}), ${agent.role || 'worker'} of project ${agent.projectPath}.`,
    ];
    if (agent.worktreePath) {
      lines.push(`You work in the worktree ${agent.worktreePath}${agent.branchName ? ` (branch ${agent.branchName})` : ''} — stay inside this directory.`);
    }
    if (agent.savedPrompt) {
      lines.push(``, `## Your role`, agent.savedPrompt);
    }
    lines.push(``, `## Your team (project ${agent.projectPath})`);
    lines.push(teammates.length ? teammates.join('\n') : '(no other agents in this project)');
    if (isOrchestrator) {
      lines.push(
        ``,
        `## Orchestration rules`,
        `- Delegate ONLY to the agents listed above — they are your project's team. Other projects' agents are off-limits and the API rejects cross-project actions.`,
        `- Use delegate_task with the agent id for one-shot delegation; list_agents already returns only your project's agents.`,
        `- No greeting ritual is needed: this roster is current as of session start, and each agent receives its own identity automatically when you delegate.`
      );
    } else {
      lines.push(
        ``,
        `## Working rules`,
        `- You may receive tasks from your project's orchestrator. Work autonomously, never ask for confirmation, and end with a clear report — the orchestrator reads your final message.`
      );
    }

    sendJson({ context: lines.join('\n') });
  });

  // GET /api/agents/:id/health — liveness of the agent's PTY and session,
  // so orchestrators/tools can distinguish "working" from "ghost status".
  app_.get(/^\/api\/agents\/([^/]+)\/health$/, (req, sendJson) => {
    const agent = agents.get(req.params.id);
    if (!agent) {
      sendJson({ error: 'Agent not found' }, 404);
      return;
    }
    const ptyAlive = !!(agent.ptyId && ptyProcesses.has(agent.ptyId));
    const lastActivityMs = Date.parse(agent.lastActivity || '') || 0;
    sendJson({
      id: agent.id,
      status: agent.status,
      waitingReason: agent.waitingReason,
      ptyAlive,
      hasLiveSession: !!agent.currentSessionId,
      secondsSinceActivity: lastActivityMs ? Math.round((Date.now() - lastActivityMs) / 1000) : null,
    });
  });

  // GET /api/agents/:id/output
  app_.get(/^\/api\/agents\/([^/]+)\/output$/, (req, sendJson) => {
    const agent = agents.get(req.params.id);
    if (!agent) {
      sendJson({ error: 'Agent not found' }, 404);
      return;
    }
    const lines = parseInt(req.url.searchParams.get('lines') || '100', 10);
    const output = agent.output.slice(-lines).join('');
    sendJson({ output, status: agent.status });
  });

  // POST /api/agents
  app_.post('/api/agents', (req, sendJson) => {
    const { projectPath, name, skills = [], character, permissionMode, secondaryProjectPath, orchestratorMode } = req.body as {
      projectPath: string;
      name?: string;
      skills?: string[];
      character?: AgentCharacter;
      permissionMode?: 'normal' | 'auto' | 'bypass';
      secondaryProjectPath?: string;
      orchestratorMode?: boolean;
    };

    if (!projectPath) {
      sendJson({ error: 'projectPath is required' }, 400);
      return;
    }

    const id = uuidv4();
    const resolvedName = name || `Agent ${id.slice(0, 6)}`;
    const lowerName = resolvedName.toLowerCase();
    const agent: AgentStatus = {
      id,
      status: 'idle',
      projectPath,
      secondaryProjectPath,
      skills,
      output: [],
      lastActivity: new Date().toISOString(),
      character,
      name: resolvedName,
      permissionMode: permissionMode || 'auto',
      orchestratorMode: orchestratorMode || false,
      role: (orchestratorMode || lowerName.includes('super agent') || lowerName.includes('orchestrator'))
        ? 'orchestrator'
        : 'worker',
    };
    agents.set(id, agent);
    saveAgents();
    sendJson({ agent });
  });

  // POST /api/agents/:id/start
  app_.post(/^\/api\/agents\/([^/]+)\/start$/, (req, sendJson) => {
    const agent = agents.get(req.params.id);
    if (!agent) {
      sendJson({ error: 'Agent not found' }, 404);
      return;
    }

    if (!assertSameProject(req, agent, sendJson)) return;

    const { prompt, model, permissionMode: bodyPermissionMode, printMode } = req.body as {
      prompt: string; model?: string; permissionMode?: 'normal' | 'auto' | 'bypass'; printMode?: boolean;
    };
    if (!prompt) {
      sendJson({ error: 'prompt is required' }, 400);
      return;
    }

    if (!spawnAgentSession(agent, prompt, { model, permissionMode: bodyPermissionMode, printMode }, ctx, sendJson)) {
      return;
    }

    sendJson({ success: true, agent: { id: agent.id, status: agent.status } });
  });

  // POST /api/agents/:id/dispatch — atomic "send this task to the agent".
  // Decides message-vs-spawn server-side, under the single-threaded event
  // loop, eliminating the GET-status-then-POST race that MCP tools had when
  // they made that decision client-side on stale status.
  app_.post(/^\/api\/agents\/([^/]+)\/dispatch$/, (req, sendJson) => {
    const agent = agents.get(req.params.id);
    if (!agent) {
      sendJson({ error: 'Agent not found' }, 404);
      return;
    }

    if (!assertSameProject(req, agent, sendJson)) return;

    const { message, model, permissionMode } = req.body as {
      message: string; model?: string; permissionMode?: 'normal' | 'auto' | 'bypass';
    };
    if (!message) {
      sendJson({ error: 'message is required' }, 400);
      return;
    }

    // BUG 4 guard: kill the PTY if its cwd no longer matches the agent's
    // worktree so the spawn path below restarts it in the right directory.
    killStalePty(agent);

    const previousStatus = agent.status;
    const livePty = agent.ptyId ? ptyProcesses.get(agent.ptyId) : undefined;
    if (livePty && (agent.status === 'running' || agent.status === 'waiting')) {
      // Live claude session mid-task or at a prompt: type the message into it.
      writeProgrammaticInput(livePty, message, true);
      agent.status = 'running';
      agent.waitingReason = undefined;
      agent.lastActivity = new Date().toISOString();
      saveAgents();
      sendJson({ success: true, mode: 'message', previousStatus, agent: { id: agent.id, name: agent.name, status: agent.status } });
      return;
    }

    // No usable session — spawn a fresh one with the message as the prompt.
    if (!spawnAgentSession(agent, message, { model, permissionMode }, ctx, sendJson)) {
      return;
    }
    sendJson({ success: true, mode: 'start', previousStatus, agent: { id: agent.id, name: agent.name, status: agent.status } });
  });

  // POST /api/agents/:id/stop
  app_.post(/^\/api\/agents\/([^/]+)\/stop$/, (req, sendJson) => {
    const agent = agents.get(req.params.id);
    if (!agent) {
      sendJson({ error: 'Agent not found' }, 404);
      return;
    }

    if (!assertSameProject(req, agent, sendJson)) return;

    if (agent.ptyId) {
      const ptyProcess = ptyProcesses.get(agent.ptyId);
      if (ptyProcess) {
        ptyProcess.kill();
        ptyProcesses.delete(agent.ptyId);
      }
    }
    agent.status = 'idle';
    agent.currentTask = undefined;
    agent.waitingReason = undefined;
    agent.currentSessionId = undefined;
    agent.lastActivity = new Date().toISOString();
    saveAgents();
    ctx.agentStatusEmitter.emit(`status:${agent.id}`);
    sendJson({ success: true });
  });

  // POST /api/agents/:id/message
  app_.post(/^\/api\/agents\/([^/]+)\/message$/, async (req, sendJson) => {
    const agent = agents.get(req.params.id);
    if (!agent) {
      sendJson({ error: 'Agent not found' }, 404);
      return;
    }

    if (!assertSameProject(req, agent, sendJson)) return;

    const { message } = req.body as { message: string };
    if (!message) {
      sendJson({ error: 'message is required' }, 400);
      return;
    }

    // BUG 4 guard: if the agent's worktreePath changed after the PTY was
    // spawned, the existing PTY is stuck in the wrong cwd. Kill it so the
    // reconnect path below spawns fresh with the correct working directory.
    killStalePty(agent);

    if (!agent.ptyId || !ptyProcesses.has(agent.ptyId)) {
      // No live PTY — the claude process exited (e.g. crashed while 'waiting').
      // Auto-respawn: start a fresh one-shot claude session using the message
      // as the prompt, identical to the /start path.  This ensures send_message
      // and delegate_task reconnect transparently instead of timing out.
      if (!spawnAgentSession(agent, message, {}, ctx, sendJson)) {
        return;
      }
      sendJson({ success: true });
      return;
    }

    const ptyProcess = ptyProcesses.get(agent.ptyId);
    if (ptyProcess) {
      writeProgrammaticInput(ptyProcess, message, true);
      agent.status = 'running';
      agent.waitingReason = undefined;
      agent.lastActivity = new Date().toISOString();
      saveAgents();
      sendJson({ success: true });
      return;
    }
    sendJson({ error: 'Failed to send message - PTY not available' }, 500);
  });

  // DELETE /api/agents/:id
  app_.delete(/^\/api\/agents\/([^/]+)$/, (req, sendJson) => {
    const agent = agents.get(req.params.id);
    if (!agent) {
      sendJson({ error: 'Agent not found' }, 404);
      return;
    }

    if (!assertSameProject(req, agent, sendJson)) return;

    if (agent.ptyId) {
      const ptyProcess = ptyProcesses.get(agent.ptyId);
      if (ptyProcess) {
        ptyProcess.kill();
        ptyProcesses.delete(agent.ptyId);
      }
    }
    agents.delete(req.params.id);
    saveAgents();
    sendJson({ success: true });
  });
}
