import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { RouteApp, RouteContext } from './types';

/**
 * Memory routes — consumed by the session hooks:
 * - session-start.sh GETs /api/memory/context and injects the result into the
 *   fresh session (additionalContext), so agents wake up knowing the project.
 * - post-tool-use.sh POSTs /api/memory/remember after significant tool uses;
 *   observations land in a capped per-project ledger.
 */

const CLAUDE_PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');
const OBSERVATIONS_DIR = path.join(os.homedir(), '.dorothy', 'observations');

const MAX_MEMORY_CHARS = 6000;     // MEMORY.md excerpt cap in the injected context
const MAX_OBSERVATIONS = 15;       // recent observations included in the context
const LEDGER_MAX_LINES = 1000;     // trim threshold for the observations ledger
const LEDGER_TRIM_TO = 500;

/** Claude Code currently encodes project dir names by collapsing every
 *  non-alphanumeric character to `-` ([^a-zA-Z0-9] in the CLI bundle) —
 *  `/Users/noah/my_app` → `-Users-noah-my-app`. */
function encodeProjectDir(projectPath: string): string {
  return projectPath.replace(/[^a-zA-Z0-9]/g, '-');
}

/** Older CLI versions used laxer encodings (dots preserved, or only `/` and
 *  `.` replaced) and those project dirs still exist on disk — probe every
 *  variant so long-lived projects keep their memory. */
function candidateProjectDirs(projectPath: string): string[] {
  return [...new Set([
    projectPath.replace(/[^a-zA-Z0-9]/g, '-'),
    projectPath.replace(/[/.]/g, '-'),
    projectPath.replace(/\//g, '-'),
  ])];
}

/** Ledger filenames derive from the encoded project dir — no user-controlled
 *  path segments survive the encoding (slashes and dots become dashes). */
function ledgerPathFor(projectPath: string): string {
  return path.join(OBSERVATIONS_DIR, `${encodeProjectDir(projectPath)}.jsonl`);
}

interface Observation {
  ts: string;
  agentId: string;
  type: string;
  content: string;
}

function readRecentObservations(projectPath: string, limit: number): Observation[] {
  try {
    const p = ledgerPathFor(projectPath);
    if (!fs.existsSync(p)) return [];
    const lines = fs.readFileSync(p, 'utf-8').trim().split('\n');
    return lines.slice(-limit).flatMap(line => {
      try { return [JSON.parse(line) as Observation]; } catch { return []; }
    });
  } catch {
    return [];
  }
}

export function registerMemoryRoutes(app: RouteApp, _ctx: RouteContext): void {
  // Memory context injected at session start (native MEMORY.md + recent activity)
  app.get('/api/memory/context', (req, sendJson) => {
    const projectPath = req.url.searchParams.get('project_path') || '';
    if (!projectPath) {
      sendJson({ context: '' });
      return;
    }

    const sections: string[] = [];

    try {
      const memoryFile = candidateProjectDirs(projectPath)
        .map(dir => path.join(CLAUDE_PROJECTS_DIR, dir, 'memory', 'MEMORY.md'))
        .find(p => fs.existsSync(p));
      if (memoryFile) {
        let content = fs.readFileSync(memoryFile, 'utf-8').trim();
        if (content.length > MAX_MEMORY_CHARS) {
          content = content.slice(0, MAX_MEMORY_CHARS) + '\n…(truncated — read the full memory/MEMORY.md)';
        }
        if (content) {
          sections.push(`## Project memory (auto-memory MEMORY.md)\n${content}`);
        }
      }
    } catch (err) {
      console.error('memory/context: failed to read MEMORY.md:', err);
    }

    const observations = readRecentObservations(projectPath, MAX_OBSERVATIONS);
    if (observations.length > 0) {
      const lines = observations.map(o => `- [${o.ts.slice(0, 16)}] ${o.content}`);
      sections.push(`## Recent activity on this project (other sessions)\n${lines.join('\n')}`);
    }

    sendJson({ context: sections.join('\n\n') });
  });

  // Observation capture from post-tool-use hooks (auth-exempt, localhost-only)
  app.post('/api/memory/remember', (req, sendJson) => {
    const agentId = typeof req.body.agent_id === 'string' ? req.body.agent_id : '';
    const projectPath = typeof req.body.project_path === 'string' ? req.body.project_path : '';
    const content = typeof req.body.content === 'string' ? req.body.content.slice(0, 500) : '';
    const type = typeof req.body.type === 'string' ? req.body.type.slice(0, 40) : 'observation';

    if (!projectPath || !content) {
      sendJson({ success: false, error: 'project_path and content are required' }, 400);
      return;
    }

    try {
      fs.mkdirSync(OBSERVATIONS_DIR, { recursive: true });
      const p = ledgerPathFor(projectPath);
      const record: Observation = { ts: new Date().toISOString(), agentId, type, content };
      fs.appendFileSync(p, JSON.stringify(record) + '\n');

      // Cap the ledger so years of tool uses don't accumulate unbounded
      const lines = fs.readFileSync(p, 'utf-8').trim().split('\n');
      if (lines.length > LEDGER_MAX_LINES) {
        fs.writeFileSync(p, lines.slice(-LEDGER_TRIM_TO).join('\n') + '\n');
      }

      sendJson({ success: true });
    } catch (err) {
      console.error('memory/remember failed:', err);
      sendJson({ success: false, error: String(err) }, 500);
    }
  });
}
