import type { Command } from 'commander';
import { log } from '@clack/prompts';
import { getInstalledVersion, downloadBinary, isBinaryInstalled } from '../lib/binary.js';
import { getLatestRelease } from '../lib/github.js';
import { getRunMode } from '../lib/config.js';
import { dockerPull } from '../lib/docker.js';

export function registerUpgrade(program: Command): void {
  program
    .command('upgrade')
    .description('Upgrade pkdns to the latest release')
    .option('--docker', 'Pull the latest Docker image instead of binary')
    .action(async (options: { docker?: boolean }) => {
      try {
        const mode = await getRunMode();
        const useDocker = options.docker || mode === 'docker';

        if (useDocker) {
          process.stdout.write('Pulling latest pkdns Docker image…\n');
          await dockerPull();
          log.success('Docker image updated. Run `pkdns restart --docker` to apply.');
          return;
        }

        if (!(await isBinaryInstalled())) {
          log.error('pkdns binary is not installed. Run `pkdns install` first.');
          process.exit(1);
        }

        const latest = await getLatestRelease();
        const currentVersion = await getInstalledVersion();

        if (currentVersion === latest.tag_name) {
          log.info(`Already up to date (${currentVersion})`);
          return;
        }

        process.stdout.write(
          `Upgrading pkdns: ${currentVersion ?? 'unknown'} → ${latest.tag_name}…\n`
        );
        await downloadBinary();
        log.success(`pkdns upgraded to ${latest.tag_name}`);
      } catch (err) {
        log.error((err as Error).message);
        process.exit(1);
      }
    });
}
