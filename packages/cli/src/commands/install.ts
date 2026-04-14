import type { Command } from 'commander';
import { log } from '@clack/prompts';
import { isBinaryInstalled, downloadBinary, getInstalledVersion } from '../lib/binary.js';
import { getLatestRelease } from '../lib/github.js';
import { configExists } from '../lib/config.js';
import { addBinToPath } from '../lib/shell.js';

export function registerInstall(program: Command): void {
  program
    .command('install')
    .description('Download and install the pkdns binary for this platform')
    .option('--version <version>', 'Install a specific version tag (e.g. v0.7.1)')
    .option('--force', 'Reinstall even if already installed')
    .action(async (options: { version?: string; force?: boolean }) => {
      const already = await isBinaryInstalled();
      const installed = already ? await getInstalledVersion() : null;

      if (already && !options.force) {
        log.info(`pkdns binary already installed (${installed ?? 'unknown version'}). Use --force to reinstall.`);
        return;
      }

      try {
        const release = options.version
          ? await (await import('../lib/github.js')).getReleaseByTag(options.version)
          : await getLatestRelease();

        const tag = release.tag_name;
        process.stdout.write(`Downloading pkdns ${tag}…\n`);
        await downloadBinary(options.version);
        log.success(`pkdns ${tag} installed`);

        const { rcFile, added } = await addBinToPath();
        if (added) {
          log.info(`Added pkdns to PATH in ${rcFile} — run: source ${rcFile}`);
        }

        if (!(await configExists())) {
          log.info('No config found. Run `pkdns init` to set up pkdns.');
        }
      } catch (err) {
        log.error((err as Error).message);
        process.exit(1);
      }
    });
}
