import type { Command } from 'commander';
import { log } from '@clack/prompts';
import { stopDaemon, startDaemon, getDaemonStatus } from '../lib/process.js';
import { dockerRestart } from '../lib/docker.js';
import { getRunMode } from '../lib/config.js';
import { CONFIG_PATH } from '../lib/paths.js';

export function registerRestart(program: Command): void {
  program
    .command('restart')
    .description('Restart the pkdns server')
    .option('--docker', 'Restart the Docker Compose service')
    .option('-v, --verbose', 'Enable verbose logging after restart')
    .option('-f, --forward <dns>', 'Override ICANN fallback DNS server')
    .action(async (options: { docker?: boolean; verbose?: boolean; forward?: string }) => {
      try {
        const mode = await getRunMode();
        const useDocker = options.docker || mode === 'docker';

        if (useDocker) {
          process.stdout.write('Restarting pkdns Docker container…\n');
          await dockerRestart();
          log.success('pkdns container restarted');
          return;
        }

        const status = await getDaemonStatus();
        if (status.running) {
          process.stdout.write('Stopping pkdns…\n');
          await stopDaemon();
        }

        const pid = await startDaemon({
          verbose: options.verbose,
          forward: options.forward,
          configPath: CONFIG_PATH,
        });

        log.success(`pkdns restarted (PID ${pid})`);
      } catch (err) {
        log.error((err as Error).message);
        process.exit(1);
      }
    });
}
