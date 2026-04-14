import TOML from '@iarna/toml';
import fs from 'fs';
import { CONFIG_PATH, CLI_META_FILE, PKDNS_DIR } from './paths.js';
import type { PkdnsConfig, CliMeta, RunMode } from '../types/config.js';

// ── pkdns.toml ────────────────────────────────────────────────────────────────

export async function readConfig(): Promise<PkdnsConfig> {
  try {
    const raw = await fs.promises.readFile(CONFIG_PATH, 'utf-8');
    return TOML.parse(raw) as unknown as PkdnsConfig;
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }
    throw err;
  }
}

/** Default values that pkdns expects when all sections are present */
const CONFIG_DEFAULTS: Required<PkdnsConfig> = {
  general: {
    socket: '0.0.0.0:53',
    forward: '8.8.8.8:53',
    dns_over_http_socket: '127.0.0.1:3000',
    verbose: false,
  },
  dns: {
    min_ttl: 60,
    max_ttl: 86400,
    query_rate_limit: 100,
    query_rate_limit_burst: 200,
    disable_any_queries: false,
    icann_cache_mb: 100,
    max_recursion_depth: 15,
  },
  dht: {
    dht_cache_mb: 100,
    dht_query_rate_limit: 5,
    dht_query_rate_limit_burst: 25,
    top_level_domain: 'key',
  },
};

function mergeWithDefaults(config: PkdnsConfig): Required<PkdnsConfig> {
  return {
    general: { ...CONFIG_DEFAULTS.general, ...config.general },
    dns: { ...CONFIG_DEFAULTS.dns, ...config.dns },
    dht: { ...CONFIG_DEFAULTS.dht, ...config.dht },
  };
}

export async function writeConfig(config: PkdnsConfig): Promise<void> {
  await fs.promises.mkdir(PKDNS_DIR, { recursive: true });
  const full = mergeWithDefaults(config);
  const content = TOML.stringify(full as TOML.JsonMap);
  const tmpPath = `${CONFIG_PATH}.tmp`;
  await fs.promises.writeFile(tmpPath, content, 'utf-8');
  await fs.promises.rename(tmpPath, CONFIG_PATH);
}

export async function configExists(): Promise<boolean> {
  try {
    await fs.promises.access(CONFIG_PATH);
    return true;
  } catch {
    return false;
  }
}

// ── CLI meta (mode, etc.) ─────────────────────────────────────────────────────

export async function readCliMeta(): Promise<CliMeta | null> {
  try {
    const raw = await fs.promises.readFile(CLI_META_FILE, 'utf-8');
    return JSON.parse(raw) as CliMeta;
  } catch {
    return null;
  }
}

export async function writeCliMeta(meta: CliMeta): Promise<void> {
  await fs.promises.mkdir(PKDNS_DIR, { recursive: true });
  await fs.promises.writeFile(CLI_META_FILE, JSON.stringify(meta, null, 2), 'utf-8');
}

export async function getRunMode(): Promise<RunMode> {
  const meta = await readCliMeta();
  return meta?.mode ?? 'binary';
}

// ── dot-notation key access ───────────────────────────────────────────────────

function getNestedValue(obj: Record<string, unknown>, dotKey: string): unknown {
  const keys = dotKey.split('.');
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function setNestedValue(obj: Record<string, unknown>, dotKey: string, value: unknown): void {
  const keys = dotKey.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (current[key] == null || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[keys[keys.length - 1]] = value;
}

function coerceValue(raw: string): unknown {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  const num = Number(raw);
  if (!isNaN(num) && raw.trim() !== '') return num;
  return raw;
}

export async function getConfigValue(dotKey: string): Promise<unknown> {
  const config = await readConfig();
  return getNestedValue(config as Record<string, unknown>, dotKey);
}

export async function setConfigValue(dotKey: string, rawValue: string): Promise<void> {
  const config = await readConfig();
  setNestedValue(config as Record<string, unknown>, dotKey, coerceValue(rawValue));
  await writeConfig(config);
}

export function getConfigPath(): string {
  return CONFIG_PATH;
}

export function formatConfigAsToml(config: PkdnsConfig): string {
  return TOML.stringify(config as TOML.JsonMap);
}
