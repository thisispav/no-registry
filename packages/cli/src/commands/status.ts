import type { Command } from 'commander';
import chalk from 'chalk';
import { getDaemonStatus, formatUptime } from '../lib/process.js';
import { dockerStatus } from '../lib/docker.js';
import { getRunMode } from '../lib/config.js';
import { getInstalledVersion } from '../lib/binary.js';
import { BINARY_PATH, CONFIG_PATH, LOG_FILE } from '../lib/paths.js';

export function registerStatus(program: Command): void {
  program
    .command('status')
    .description('Show pkdns server status')
    .option('--docker', 'Show Docker container status')
    .action(async (options: { docker?: boolean }) => {
      try {
        const mode = await getRunMode();
        const useDocker = options.docker || mode === 'docker';

        if (useDocker) {
          const s = await dockerStatus();
          if (!s.running || s.containers.length === 0) {
            console.log(chalk.red('●') + ' pkdns is not running (Docker)');
            return;
          }
          console.log(chalk.green('●') + ' pkdns is running (Docker)');
          for (const c of s.containers) {
            console.log(`  ${chalk.dim('Container:')} ${c.name}`);
            console.log(`  ${chalk.dim('State:')}     ${c.state}`);
            console.log(`  ${chalk.dim('Status:')}    ${c.status}`);
            if (c.ports) console.log(`  ${chalk.dim('Ports:')}     ${c.ports}`);
          }
          return;
        }

        const s = await getDaemonStatus();

        if (!s.running) {
          console.log(chalk.red('●') + ' pkdns is not running');
          return;
        }

        const version = await getInstalledVersion();
        const uptime = s.uptime != null ? formatUptime(s.uptime) : 'unknown';

        console.log(chalk.green('●') + ' pkdns is running');
        console.log(`  ${chalk.dim('PID:')}     ${s.pid}`);
        console.log(`  ${chalk.dim('Uptime:')}  ${uptime}`);
        if (version) console.log(`  ${chalk.dim('Version:')} ${version}`);
        console.log(`  ${chalk.dim('Binary:')}  ${BINARY_PATH}`);
        console.log(`  ${chalk.dim('Config:')}  ${CONFIG_PATH}`);
        console.log(`  ${chalk.dim('Logs:')}    ${LOG_FILE}`);
      } catch (err) {
        console.error(chalk.red('Error:'), (err as Error).message);
        process.exit(1);
      }
    });
}
