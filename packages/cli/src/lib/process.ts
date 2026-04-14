import { spawn, execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import { BINARY_PATH, PID_FILE, LOG_FILE, META_FILE } from './paths.js';

const execFileAsync = promisify(execFile);

export interface DaemonStatus {
  running: boolean;
  pid?: number;
  uptime?: number;
  startTime?: Date;
}

export interface StartOptions {
  verbose?: boolean;
  forward?: string;
  configPath?: string;
  pkdnsDir?: string;
}

async function readPid(): Promise<number | null> {
  try {
    const raw = await fs.promises.readFile(PID_FILE, 'utf-8');
    const pid = parseInt(raw.trim(), 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

async function writePid(pid: number): Promise<void> {
  await fs.promises.writeFile(PID_FILE, String(pid), 'utf-8');
}

async function removePid(): Promise<void> {
  await fs.promises.unlink(PID_FILE).catch(() => {});
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function writeMeta(meta: { startTime: string }): Promise<void> {
  await fs.promises.writeFile(META_FILE, JSON.stringify(meta), 'utf-8');
}

async function readMeta(): Promise<{ startTime: string } | null> {
  try {
    const raw = await fs.promises.readFile(META_FILE, 'utf-8');
    return JSON.parse(raw) as { startTime: string };
  } catch {
    return null;
  }
}

export async function getDaemonStatus(): Promise<DaemonStatus> {
  const pid = await readPid();

  if (pid === null) {
    return { running: false };
  }

  if (!isProcessAlive(pid)) {
    await removePid();
    await fs.promises.unlink(META_FILE).catch(() => {});
    return { running: false };
  }

  const meta = await readMeta();
  const startTime = meta ? new Date(meta.startTime) : undefined;
  const uptime = startTime ? Date.now() - startTime.getTime() : undefined;

  return { running: true, pid, uptime, startTime };
}

export async function startDaemon(options: StartOptions = {}): Promise<number> {
  const args: string[] = [];

  if (options.verbose) args.push('--verbose');
  if (options.forward) args.push('--forward', options.forward);
  if (options.configPath) args.push('--config', options.configPath);
  if (options.pkdnsDir) args.push('--pkdns-dir', options.pkdnsDir);

  const logFd = fs.openSync(LOG_FILE, 'a');

  const child = spawn(BINARY_PATH, args, {
    detached: true,
    stdio: ['ignore', logFd, logFd],
  });

  child.unref();
  fs.closeSync(logFd);

  if (child.pid === undefined) {
    throw new Error('Failed to start pkdns: no PID returned');
  }

  await writePid(child.pid);
  await writeMeta({ startTime: new Date().toISOString() });

  return child.pid;
}

export async function stopDaemon(): Promise<void> {
  const pid = await readPid();

  if (pid === null) {
    throw new Error('pkdns is not running (no PID file)');
  }

  if (!isProcessAlive(pid)) {
    await removePid();
    throw new Error('pkdns is not running (stale PID file removed)');
  }

  if (process.platform === 'win32') {
    await execFileAsync('taskkill', ['/F', '/PID', String(pid)]);
  } else {
    process.kill(pid, 'SIGTERM');
  }

  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (!isProcessAlive(pid)) break;
    await new Promise((r) => setTimeout(r, 200));
  }

  if (isProcessAlive(pid)) {
    process.kill(pid, 'SIGKILL');
  }

  await removePid();
  await fs.promises.unlink(META_FILE).catch(() => {});
}

export function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${sec}s`);
  return parts.join(' ');
}
