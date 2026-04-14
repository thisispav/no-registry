import type { Command } from 'commander';
import { log } from '@clack/prompts';
import { stopDaemon } from '../lib/process.js';
import { dockerDown } from '../lib/docker.js';
import { getRunMode } from '../lib/config.js';

export function registerStop(program: Command): void {
  program
    .command('stop')
    .description('Stop the pkdns server')
    .option('--docker', 'Stop the Docker Compose service')
    .action(async (options: { docker?: boolean }) => {
      try {
        const mode = await getRunMode();
        const useDocker = options.docker || mode === 'docker';

        if (useDocker) {
          process.stdout.write('Stopping pkdns Docker container…\n');
          await dockerDown();
          log.success('pkdns container stopped');
          return;
        }

        await stopDaemon();
        log.success('pkdns stopped');
      } catch (err) {
        log.error((err as Error).message);
        process.exit(1);
      }
    });
}
