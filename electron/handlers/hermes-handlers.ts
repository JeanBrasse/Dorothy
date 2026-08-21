import { ipcMain } from 'electron';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as http from 'http';

const execFileAsync = promisify(execFile);

const API_PORT = 31415;

/**
 * Hermes integration handlers — everything the Settings → Hermes section
 * needs to wire a remote (VPS) Hermes instance to this Dorothy:
 * - connection info: the incoming-webhook URL/token to paste into Hermes
 *   cron jobs, plus Tailscale state (DNS name, serve status) so the user
 *   knows exactly how the VPS reaches this machine
 * - a local dry-run test of the webhook (auth + agent resolution, no dispatch)
 * - a reachability check of the Hermes gateway URL itself
 */

interface TailscaleInfo {
  installed: boolean;
  running: boolean;
  dnsName?: string;
  ip?: string;
  serveConfigured: boolean;
}

async function detectTailscale(): Promise<TailscaleInfo> {
  const candidates = ['tailscale', '/usr/local/bin/tailscale', '/Applications/Tailscale.app/Contents/MacOS/Tailscale'];
  for (const bin of candidates) {
    try {
      const { stdout } = await execFileAsync(bin, ['status', '--json'], { timeout: 4000 });
      const status = JSON.parse(stdout);
      const dnsName = typeof status?.Self?.DNSName === 'string'
        ? status.Self.DNSName.replace(/\.$/, '')
        : undefined;
      const ip = Array.isArray(status?.Self?.TailscaleIPs) ? status.Self.TailscaleIPs[0] : undefined;

      let serveConfigured = false;
      try {
        const { stdout: serveOut } = await execFileAsync(bin, ['serve', 'status'], { timeout: 4000 });
        serveConfigured = !/no serve config/i.test(serveOut) && serveOut.trim().length > 0;
      } catch { /* serve status exits non-zero when unconfigured on some versions */ }

      return {
        installed: true,
        running: status?.BackendState === 'Running',
        dnsName,
        ip,
        serveConfigured,
      };
    } catch { /* try next candidate */ }
  }
  return { installed: false, running: false, serveConfigured: false };
}

function readApiToken(): string {
  try {
    return fs.readFileSync(path.join(os.homedir(), '.dorothy', 'api-token'), 'utf-8').trim();
  } catch {
    return '';
  }
}

/** POST JSON to the local API and resolve with {status, body}. */
function postLocal(pathname: string, token: string, payload: unknown): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = http.request({
      host: '127.0.0.1',
      port: API_PORT,
      path: pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'Authorization': `Bearer ${token}`,
      },
      timeout: 5000,
    }, res => {
      let raw = '';
      res.on('data', c => { raw += c; });
      res.on('end', () => {
        let body: unknown = raw;
        try { body = JSON.parse(raw); } catch { /* keep raw */ }
        resolve({ status: res.statusCode ?? 0, body });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(data);
    req.end();
  });
}

export function registerHermesHandlers(): void {
  ipcMain.handle('hermes:getConnectionInfo', async () => {
    const [tailscale, token] = await Promise.all([detectTailscale(), Promise.resolve(readApiToken())]);

    const tailnetUrl = tailscale.dnsName
      ? `https://${tailscale.dnsName}/api/webhooks/hermes`
      : undefined;

    return {
      apiPort: API_PORT,
      webhookPath: '/api/webhooks/hermes',
      webhookLocalUrl: `http://127.0.0.1:${API_PORT}/api/webhooks/hermes`,
      webhookTailnetUrl: tailnetUrl,
      apiToken: token,
      tailscale,
      // tailscale serve terminates HTTPS on the tailnet name and proxies to
      // the localhost-bound API — no bind change needed.
      serveCommand: `tailscale serve --bg ${API_PORT}`,
    };
  });

  // Local dry-run of the incoming webhook: proves auth + agent resolution
  // end-to-end through the real HTTP stack, without dispatching anything.
  ipcMain.handle('hermes:testWebhook', async (_event, params: { agentName?: string; agentId?: string; projectPath?: string }) => {
    try {
      const token = readApiToken();
      if (!token) return { success: false, error: 'No API token found (~/.dorothy/api-token)' };
      const { status, body } = await postLocal('/api/webhooks/hermes', token, {
        agent_id: params?.agentId || undefined,
        agent_name: params?.agentName || undefined,
        project_path: params?.projectPath || undefined,
        message: 'dry run',
        dry_run: true,
      });
      return { success: status === 200, status, response: body };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // Reachability check of the remote Hermes gateway (any HTTP response counts —
  // we only prove the tailnet route works, not the gateway's API shape).
  ipcMain.handle('hermes:testGateway', async (_event, url: string) => {
    if (typeof url !== 'string' || !/^https?:\/\//.test(url.trim())) {
      return { success: false, error: 'Enter an http(s):// URL first' };
    }
    try {
      const target = new URL(url.trim());
      const mod = target.protocol === 'https:' ? await import('https') : await import('http');
      const status = await new Promise<number>((resolve, reject) => {
        const req = mod.request(target, { method: 'GET', timeout: 6000 }, res => {
          res.resume();
          resolve(res.statusCode ?? 0);
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
        req.end();
      });
      return { success: true, status };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}
