import type { Command } from 'commander';
import { log } from '@clack/prompts';
import { spawn } from 'child_process';
import fs from 'fs';
import { getRunMode } from '../lib/config.js';
import { dockerLogs } from '../lib/docker.js';
import { LOG_FILE } from '../lib/paths.js';

export function registerLogs(program: Command): void {
  program
    .command('logs')
    .description('Show pkdns server logs')
    .option('-f, --follow', 'Follow log output (like tail -f)')
    .option('-n, --lines <number>', 'Number of lines to show', '50')
    .option('--docker', 'Show Docker container logs')
    .action(async (options: { follow?: boolean; lines?: string; docker?: boolean }) => {
      try {
        const mode = await getRunMode();
        const useDocker = options.docker || mode === 'docker';
        const lines = parseInt(options.lines ?? '50', 10);

        if (useDocker) {
          dockerLogs({ follow: options.follow, lines });
          return;
        }

        try {
          await fs.promises.access(LOG_FILE);
        } catch {
          log.error(`Log file not found: ${LOG_FILE}`);
          log.info('Start pkdns first with `pkdns start`');
          process.exit(1);
        }

        if (options.follow) {
          const child = spawn('tail', ['-f', '-n', String(lines), LOG_FILE], {
            stdio: 'inherit',
          });
          child.on('error', () => {
            // tail not available (Windows), fallback to fs.watch
            streamLogFile(LOG_FILE, lines);
          });
        } else {
          const child = spawn('tail', ['-n', String(lines), LOG_FILE], { stdio: 'inherit' });
          child.on('error', async () => {
            // fallback for Windows
            const content = await fs.promises.readFile(LOG_FILE, 'utf-8');
            const tail = content.split('\n').slice(-lines).join('\n');
            process.stdout.write(tail + '\n');
          });
        }
      } catch (err) {
        log.error((err as Error).message);
        process.exit(1);
      }
    });
}

function streamLogFile(filePath: string, initialLines: number): void {
  fs.promises.readFile(filePath, 'utf-8').then((content) => {
    const lines = content.split('\n').slice(-initialLines);
    process.stdout.write(lines.join('\n') + '\n');

    let lastSize = Buffer.byteLength(content);
    fs.watch(filePath, () => {
      fs.promises.stat(filePath).then((stat) => {
        if (stat.size > lastSize) {
          const stream = fs.createReadStream(filePath, { start: lastSize });
          stream.pipe(process.stdout);
          lastSize = stat.size;
        }
      });
    });
  });
}
