import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';
import type { Command } from 'commander';
import { log, spinner } from '@clack/prompts';
import chalk from 'chalk';
import { BIN_DIR, UPDATE_CACHE_FILE } from '../lib/paths.js';
import { detectPlatform } from '../lib/platform.js';
import { fetchLatestVersion, isNewerVersion } from '../lib/update-check.js';

const CLI_REPO = 'thisispav/no-registry';
const execFileAsync = promisify(execFile);

async function findBinary(dir: string): Promise<string | null> {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      const found = await findBinary(full);
      if (found) return found;
    } else if (e.name === 'pkdns' && e.isFile()) {
      return full;
    }
  }
  return null;
}

export function registerUpdateCli(program: Command): void {
  program
    .command('update-cli')
    .description('Update pkdns-cli to the latest version')
    .action(async () => {
      const currentVersion = program.version() ?? '0.0.0';
      const installedBinaryPath = path.join(BIN_DIR, 'pkdns');

      const s = spinner();
      s.start('Checking for updates…');

      let latest: string;
      try {
        latest = await fetchLatestVersion();
      } catch (err) {
        s.stop('Could not reach npm registry');
        log.error((err as Error).message);
        process.exit(1);
        return;
      }

      s.stop(`Latest: ${chalk.cyan(`v${latest}`)}  ·  Installed: ${chalk.dim(`v${currentVersion}`)}`);

      if (!isNewerVersion(currentVersion, latest)) {
        log.success(`pkdns-cli is already up to date (v${currentVersion})`);
        return;
      }

      // Detect install method: compiled binary vs bunx/npx
      const isInstalledBinary = process.execPath === installedBinaryPath;

      if (!isInstalledBinary) {
        log.info(
          [
            `pkdns-cli ${chalk.bold(`v${latest}`)} is available.`,
            `  Bun:  ${chalk.cyan(`bunx pkdns-cli@${latest} <command>`)}`,
            `  Node: ${chalk.cyan(`npx  pkdns-cli@${latest} <command>`)}`,
          ].join('\n')
        );
        return;
      }

      // Binary install — download the new tarball from GitHub releases
      const platform = detectPlatform();
      const asset = `pkdns-v${latest}-${platform}.tar.gz`;
      const url = `https://github.com/${CLI_REPO}/releases/download/v${latest}/${asset}`;

      const s2 = spinner();
      s2.start(`Downloading pkdns-cli v${latest}…`);

      const tmpTar = path.join(os.tmpdir(), `pkdns-cli-update-${Date.now()}.tar.gz`);
      const tmpDir = path.join(os.tmpdir(), `pkdns-cli-update-${Date.now()}`);

      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'pkdns-cli' },
          signal: AbortSignal.timeout(30_000),
        });
        if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);

        await fs.promises.writeFile(tmpTar, Buffer.from(await res.arrayBuffer()));

        s2.message('Installing…');

        await fs.promises.mkdir(tmpDir, { recursive: true });
        await execFileAsync('tar', ['-xzf', tmpTar, '-C', tmpDir]);

        const extracted = await findBinary(tmpDir);
        if (!extracted) throw new Error('Could not find pkdns binary in downloaded archive');

        await fs.promises.chmod(extracted, 0o755);
        await fs.promises.rename(extracted, installedBinaryPath);

        // Bust the update-check cache so the new version is reflected immediately
        await fs.promises.unlink(UPDATE_CACHE_FILE).catch(() => {});

        s2.stop(`pkdns-cli updated to v${latest}`);
      } catch (err) {
        s2.stop('Update failed');
        log.error((err as Error).message);
        process.exit(1);
      } finally {
        await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
        await fs.promises.unlink(tmpTar).catch(() => {});
      }
    });
}
