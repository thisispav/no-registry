import type { Command } from 'commander';
import { log } from '@clack/prompts';
import { isBinaryInstalled } from '../lib/binary.js';
import { startDaemon, getDaemonStatus } from '../lib/process.js';
import { dockerUp, isDockerAvailable, ensureComposeFile } from '../lib/docker.js';
import { readConfig, getRunMode } from '../lib/config.js';
import { CONFIG_PATH } from '../lib/paths.js';

export function registerStart(program: Command): void {
  program
    .command('start')
    .description('Start the pkdns server')
    .option('--docker', 'Start using Docker Compose')
    .option('-v, --verbose', 'Enable verbose logging')
    .option('-f, --forward <dns>', 'Override ICANN fallback DNS server (e.g. 1.1.1.1:53)')
    .action(async (options: { docker?: boolean; verbose?: boolean; forward?: string }) => {
      try {
        const config = await readConfig();
        const mode = await getRunMode();
        const useDocker = options.docker || mode === 'docker';

        if (useDocker) {
          if (!(await isDockerAvailable())) {
            log.error('Docker is not available. Install Docker Desktop and try again.');
            process.exit(1);
          }
          await ensureComposeFile();
          process.stdout.write('Starting pkdns via Docker Compose…\n');
          await dockerUp({ detach: true });
          log.success('pkdns container started');
          return;
        }

        if (!(await isBinaryInstalled())) {
          log.error('pkdns binary is not installed. Run `pkdns install` first.');
          process.exit(1);
        }

        const status = await getDaemonStatus();
        if (status.running) {
          log.warn(`pkdns is already running (PID ${status.pid})`);
          return;
        }

        // Warn about port 53 without root
        if (config.general?.socket?.endsWith(':53')) {
          if (typeof process.getuid === 'function' && process.getuid() !== 0) {
            log.warn('Binding to port 53 may require root. If this fails, try: sudo pkdns start');
          }
        }

        const pid = await startDaemon({
          verbose: options.verbose,
          forward: options.forward,
          configPath: CONFIG_PATH,
        });

        log.success(`pkdns started (PID ${pid})`);
      } catch (err) {
        log.error((err as Error).message);
        process.exit(1);
      }
    });
}
