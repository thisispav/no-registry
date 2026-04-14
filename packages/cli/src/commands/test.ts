import type { Command } from 'commander';
import chalk from 'chalk';
import { promises as dnsPromises } from 'dns';
import { isBinaryInstalled, getInstalledVersion } from '../lib/binary.js';
import { configExists, getRunMode } from '../lib/config.js';
import { getDaemonStatus } from '../lib/process.js';
import { dockerStatus } from '../lib/docker.js';

interface TestResult {
  label: string;
  passed: boolean;
  detail?: string;
}

function printResult(r: TestResult): void {
  const icon = r.passed ? chalk.green('✓') : chalk.red('✗');
  const detail = r.detail ? chalk.dim(` (${r.detail})`) : '';
  console.log(`  ${icon} ${r.label}${detail}`);
}

export function registerTest(program: Command): void {
  program
    .command('test')
    .description('Run a self-test to verify pkdns is set up correctly')
    .option('--docker', 'Test Docker-based setup')
    .action(async (options: { docker?: boolean }) => {
      console.log(chalk.bold('\npkdns self-test\n'));

      const mode = await getRunMode();
      const useDocker = options.docker || mode === 'docker';
      const results: TestResult[] = [];

      // Check 1: Binary or Docker
      if (!useDocker) {
        const installed = await isBinaryInstalled();
        const version = installed ? await getInstalledVersion() : null;
        results.push({
          label: 'pkdns binary installed',
          passed: installed,
          detail: version ?? 'not found',
        });
      } else {
        const dockerAvailable = await checkDockerAvailable();
        results.push({
          label: 'Docker available',
          passed: dockerAvailable,
          detail: dockerAvailable ? 'ok' : 'docker not found',
        });
      }

      // Check 2: Config file
      const hasConfig = await configExists();
      results.push({
        label: 'Config file exists (~/.pkdns/pkdns.toml)',
        passed: hasConfig,
        detail: hasConfig ? 'ok' : 'run `pkdns init`',
      });

      // Check 3: Process running
      if (!useDocker) {
        const status = await getDaemonStatus();
        results.push({
          label: 'pkdns process running',
          passed: status.running,
          detail: status.running ? `PID ${status.pid}` : 'not running',
        });
      } else {
        const status = await dockerStatus();
        results.push({
          label: 'pkdns Docker container running',
          passed: status.running,
          detail: status.running ? 'running' : 'not running',
        });
      }

      // Check 4: DNS resolution (only if process is running)
      const processRunning = results[results.length - 1].passed;
      if (processRunning) {
        const resolver = new dnsPromises.Resolver({ timeout: 3000 });
        resolver.setServers(['127.0.0.1:53']);

        // Test ICANN resolution via pkdns
        try {
          await resolver.resolve4('example.com');
          results.push({ label: 'ICANN DNS forwarding works (example.com)', passed: true });
        } catch {
          results.push({
            label: 'ICANN DNS forwarding works (example.com)',
            passed: false,
            detail: 'resolution failed',
          });
        }
      } else {
        results.push({
          label: 'DNS resolution test',
          passed: false,
          detail: 'skipped — pkdns not running',
        });
      }

      // Print results
      for (const r of results) printResult(r);

      const passed = results.filter((r) => r.passed).length;
      const total = results.length;
      const allPassed = passed === total;

      console.log(
        `\n${allPassed ? chalk.green('All checks passed') : chalk.yellow(`${passed}/${total} checks passed`)}\n`
      );

      if (!allPassed) process.exit(1);
    });
}

async function checkDockerAvailable(): Promise<boolean> {
  try {
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    await promisify(execFile)('docker', ['info'], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}
