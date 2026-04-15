import fs from 'fs';
import chalk from 'chalk';
import { UPDATE_CACHE_FILE, PKDNS_DIR } from './paths.js';

const PACKAGE_NAME = 'pkdns-cli';
const REGISTRY_URL = `https://registry.npmjs.org/${PACKAGE_NAME}/latest`;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface UpdateCache {
  checkedAt: string;
  latestVersion: string;
}

export function isNewerVersion(current: string, latest: string): boolean {
  const parse = (v: string) => v.replace(/^v/, '').split('.').map(Number);
  const cur = parse(current);
  const lat = parse(latest);
  if (cur.length < 3 || lat.length < 3 || cur.some(Number.isNaN) || lat.some(Number.isNaN))
    return false;
  const [cMaj, cMin, cPatch] = cur;
  const [lMaj, lMin, lPatch] = lat;
  if (lMaj !== cMaj) return lMaj > cMaj;
  if (lMin !== cMin) return lMin > cMin;
  return lPatch > cPatch;
}

async function getCachedLatest(): Promise<string | null> {
  try {
    const raw = await fs.promises.readFile(UPDATE_CACHE_FILE, 'utf-8');
    const cache = JSON.parse(raw) as UpdateCache;
    const age = Date.now() - new Date(cache.checkedAt).getTime();
    if (age < CACHE_TTL_MS) return cache.latestVersion;
  } catch {
    // no cache or unreadable — fall through
  }
  return null;
}

export async function fetchLatestVersion(): Promise<string> {
  const res = await fetch(REGISTRY_URL, {
    headers: { 'User-Agent': 'pkdns-cli' },
    signal: AbortSignal.timeout(3000),
  });
  if (!res.ok) throw new Error(`npm registry responded ${res.status}`);
  const data = (await res.json()) as { version: string };
  return data.version;
}

async function saveCache(latestVersion: string): Promise<void> {
  const cache: UpdateCache = { checkedAt: new Date().toISOString(), latestVersion };
  await fs.promises.mkdir(PKDNS_DIR, { recursive: true });
  await fs.promises.writeFile(UPDATE_CACHE_FILE, JSON.stringify(cache, null, 2));
}

export async function checkForCliUpdate(currentVersion: string): Promise<void> {
  try {
    let latest = await getCachedLatest();
    if (!latest) {
      latest = await fetchLatestVersion();
      await saveCache(latest).catch(() => {});
    }
    if (isNewerVersion(currentVersion, latest)) {
      console.warn(
        chalk.yellow(`\n  pkdns-cli ${chalk.bold(`v${latest}`)} is available`) +
          chalk.dim(` (you have v${currentVersion})`) +
          `\n  Run: ${chalk.cyan(`bunx pkdns-cli@${latest}`)}\n`
      );
    }
  } catch {
    // network failure or parse error — silently skip
  }
}
