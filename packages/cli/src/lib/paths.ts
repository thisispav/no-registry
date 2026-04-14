import os from 'os';
import path from 'path';

export const PKDNS_DIR = process.env.PKDNS_DIR ?? path.join(os.homedir(), '.pkdns');
export const BIN_DIR = path.join(PKDNS_DIR, 'bin');
export const BINARY_PATH = path.join(BIN_DIR, process.platform === 'win32' ? 'pkdns.exe' : 'pkdns');
export const CONFIG_PATH = path.join(PKDNS_DIR, 'pkdns.toml');
export const COMPOSE_PATH = path.join(PKDNS_DIR, 'compose.yaml');
export const PID_FILE = path.join(PKDNS_DIR, 'pkdns.pid');
export const LOG_FILE = path.join(PKDNS_DIR, 'pkdns.log');
export const META_FILE = path.join(PKDNS_DIR, 'pkdns-meta.json');
export const VERSION_FILE = path.join(PKDNS_DIR, 'installed-version.json');
/** CLI-specific metadata (mode, etc.) — separate from pkdns.toml */
export const CLI_META_FILE = path.join(PKDNS_DIR, 'pkdns-cli.json');
/** Cached result of the npm update check */
export const UPDATE_CACHE_FILE = path.join(PKDNS_DIR, 'update-check.json');
