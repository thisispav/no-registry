import { describe, it, expect, beforeAll, afterAll, mock } from 'bun:test';
import os from 'os';
import path from 'path';
import fs from 'fs';

// Create an isolated temp dir for all tests in this file
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkdns-test-'));
const tmpConfig = path.join(tmpDir, 'pkdns.toml');
const tmpCliMeta = path.join(tmpDir, 'pkdns-cli.json');

// Mock the paths module BEFORE the config module is imported
mock.module('./paths.js', () => ({
  CONFIG_PATH: tmpConfig,
  CLI_META_FILE: tmpCliMeta,
  PKDNS_DIR: tmpDir,
  BIN_DIR: path.join(tmpDir, 'bin'),
  BINARY_PATH: path.join(tmpDir, 'bin', 'pkdns'),
  COMPOSE_PATH: path.join(tmpDir, 'compose.yaml'),
  PID_FILE: path.join(tmpDir, 'pkdns.pid'),
  LOG_FILE: path.join(tmpDir, 'pkdns.log'),
  META_FILE: path.join(tmpDir, 'pkdns-meta.json'),
  VERSION_FILE: path.join(tmpDir, 'installed-version.json'),
  CLI_META_FILE: tmpCliMeta,
}));

// Import AFTER mock is set up
const { readConfig, writeConfig, getConfigValue, setConfigValue, configExists } =
  await import('./config.js');

afterAll(async () => {
  await fs.promises.rm(tmpDir, { recursive: true, force: true });
});

// Reset config file before each test
async function resetConfig() {
  await fs.promises.unlink(tmpConfig).catch(() => {});
}

describe('readConfig', () => {
  it('returns empty object when no config file exists', async () => {
    await resetConfig();
    const config = await readConfig();
    expect(config).toEqual({});
  });
});

describe('writeConfig / readConfig round-trip', () => {
  it('writes and reads back general settings', async () => {
    await resetConfig();
    await writeConfig({ general: { forward: '1.1.1.1:53', socket: '0.0.0.0:5300' } });
    const config = await readConfig();
    expect(config.general?.forward).toBe('1.1.1.1:53');
    expect(config.general?.socket).toBe('0.0.0.0:5300');
  });

  it('merges defaults so all three sections are always written', async () => {
    await resetConfig();
    await writeConfig({ general: { forward: '1.1.1.1:53' } });
    const config = await readConfig();
    expect(config.general).toBeDefined();
    expect(config.dns).toBeDefined();
    expect(config.dht).toBeDefined();
  });
});

describe('configExists', () => {
  it('returns false when no file', async () => {
    await resetConfig();
    expect(await configExists()).toBe(false);
  });

  it('returns true after writing', async () => {
    await resetConfig();
    await writeConfig({});
    expect(await configExists()).toBe(true);
  });
});

describe('getConfigValue / setConfigValue', () => {
  it('sets and gets a nested string value', async () => {
    await resetConfig();
    await setConfigValue('general.forward', '9.9.9.9:53');
    expect(await getConfigValue('general.forward')).toBe('9.9.9.9:53');
  });

  it('coerces numeric strings to numbers', async () => {
    await resetConfig();
    await setConfigValue('dns.max_ttl', '7200');
    expect(await getConfigValue('dns.max_ttl')).toBe(7200);
  });

  it('coerces boolean strings', async () => {
    await resetConfig();
    await setConfigValue('general.verbose', 'true');
    expect(await getConfigValue('general.verbose')).toBe(true);
  });

  it('returns undefined for a missing key', async () => {
    await resetConfig();
    await writeConfig({});
    expect(await getConfigValue('general.nonexistent')).toBeUndefined();
  });
});
