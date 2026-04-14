import type { Command } from 'commander';
import { execFile } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import { isBinaryInstalled, getInstalledVersion } from '../lib/binary.js';
import { BINARY_PATH } from '../lib/paths.js';

const execFileAsync = promisify(execFile);

const CLI_VERSION = '0.1.0';

export function registerVersion(program: Command): void {
  program
    .command('version')
    .description('Show pkdns-cli and pkdns binary version')
    .action(async () => {
      console.log(`pkdns-cli: ${chalk.cyan(CLI_VERSION)}`);

      const installed = await isBinaryInstalled();
      if (!installed) {
        console.log(`pkdns binary: ${chalk.dim('not installed')}`);
        return;
      }

      const savedVersion = await getInstalledVersion();
      if (savedVersion) {
        console.log(`pkdns binary: ${chalk.cyan(savedVersion)}`);
        return;
      }

      // Fallback: run the binary with --version
      try {
        const { stdout } = await execFileAsync(BINARY_PATH, ['--version'], { timeout: 3000 });
        console.log(`pkdns binary: ${chalk.cyan(stdout.trim())}`);
      } catch {
        console.log(`pkdns binary: ${chalk.dim('installed (version unknown)')}`);
      }
    });
}
