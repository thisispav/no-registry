import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import { COMPOSE_PATH, PKDNS_DIR } from './paths.js';

const execFileAsync = promisify(execFile);

const COMPOSE_YAML_URL =
  'https://raw.githubusercontent.com/pubky/pkdns/main/compose.yaml';

export interface DockerStatus {
  running: boolean;
  containers: DockerContainer[];
}

export interface DockerContainer {
  name: string;
  state: string;
  status: string;
  ports: string;
}

export async function isDockerAvailable(): Promise<boolean> {
  try {
    await execFileAsync('docker', ['info'], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

export async function ensureComposeFile(): Promise<void> {
  try {
    await fs.promises.access(COMPOSE_PATH);
    return;
  } catch {
    // not present, download it
  }

  const res = await fetch(COMPOSE_YAML_URL, { headers: { 'User-Agent': 'pkdns-cli' } });
  if (!res.ok) {
    throw new Error(`Failed to fetch compose.yaml: ${res.status} ${res.statusText}`);
  }

  await fs.promises.mkdir(PKDNS_DIR, { recursive: true });
  const content = await res.text();
  await fs.promises.writeFile(COMPOSE_PATH, content, 'utf-8');
}

async function dockerCompose(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync('docker', ['compose', '-f', COMPOSE_PATH, ...args], {
    cwd: PKDNS_DIR,
    timeout: 60000,
  });
}

export async function dockerUp(options: { detach?: boolean } = {}): Promise<void> {
  const args = ['up'];
  if (options.detach !== false) args.push('-d');
  await dockerCompose(args);
}

export async function dockerDown(): Promise<void> {
  await dockerCompose(['down']);
}

export async function dockerRestart(): Promise<void> {
  await dockerCompose(['restart']);
}

export async function dockerPull(): Promise<void> {
  await dockerCompose(['pull']);
}

export async function dockerStatus(): Promise<DockerStatus> {
  try {
    const { stdout } = await dockerCompose(['ps', '--format', 'json']);
    const lines = stdout.trim().split('\n').filter(Boolean);
    const containers: DockerContainer[] = [];

    for (const line of lines) {
      try {
        const obj = JSON.parse(line) as {
          Name?: string;
          State?: string;
          Status?: string;
          Publishers?: Array<{ PublishedPort?: number; TargetPort?: number; Protocol?: string }>;
        };
        const ports = (obj.Publishers ?? [])
          .filter((p) => p.PublishedPort)
          .map((p) => `${p.PublishedPort}->${p.TargetPort}/${p.Protocol}`)
          .join(', ');
        containers.push({
          name: obj.Name ?? '',
          state: obj.State ?? '',
          status: obj.Status ?? '',
          ports,
        });
      } catch {
        // skip malformed lines
      }
    }

    const running = containers.some((c) => c.state === 'running');
    return { running, containers };
  } catch {
    return { running: false, containers: [] };
  }
}

export function dockerLogs(options: { follow?: boolean; lines?: number } = {}): void {
  const args = ['compose', '-f', COMPOSE_PATH, 'logs'];
  if (options.follow) args.push('-f');
  if (options.lines != null) args.push('--tail', String(options.lines));

  const child = spawn('docker', args, { cwd: PKDNS_DIR, stdio: 'inherit' });
  child.on('error', (err) => {
    process.stderr.write(`docker: ${err.message}\n`);
    process.exit(1);
  });
}
