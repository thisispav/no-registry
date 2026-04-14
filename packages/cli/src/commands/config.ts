import type { Command } from 'commander';
import { log } from '@clack/prompts';
import chalk from 'chalk';
import { readConfig, getConfigValue, setConfigValue, getConfigPath, formatConfigAsToml } from '../lib/config.js';

export function registerConfig(program: Command): void {
  const config = program
    .command('config')
    .description('Manage pkdns configuration');

  config
    .command('show')
    .description('Print the current configuration')
    .action(async () => {
      try {
        const cfg = await readConfig();
        const toml = formatConfigAsToml(cfg);

        if (!toml.trim()) {
          log.info(`No configuration found at ${getConfigPath()}. Run \`pkdns init\` to create one.`);
          return;
        }

        // Syntax-highlight: keys in cyan, values in yellow
        const highlighted = toml
          .split('\n')
          .map((line) => {
            if (line.startsWith('[')) return chalk.bold.blue(line);
            const eqIdx = line.indexOf('=');
            if (eqIdx !== -1) {
              const key = line.slice(0, eqIdx);
              const value = line.slice(eqIdx);
              return chalk.cyan(key) + chalk.dim('=') + chalk.yellow(value.slice(1));
            }
            return line;
          })
          .join('\n');

        console.log(highlighted);
        console.log(chalk.dim(`\nConfig file: ${getConfigPath()}`));
      } catch (err) {
        log.error((err as Error).message);
        process.exit(1);
      }
    });

  config
    .command('get')
    .description('Get a configuration value by dot-notation key')
    .argument('<key>', 'Dot-notation key (e.g. dns.forward)')
    .action(async (key: string) => {
      try {
        const value = await getConfigValue(key);
        if (value === undefined) {
          log.error(`Key not found: ${key}`);
          process.exit(1);
        }
        console.log(String(value));
      } catch (err) {
        log.error((err as Error).message);
        process.exit(1);
      }
    });

  config
    .command('set')
    .description('Set a configuration value by dot-notation key')
    .argument('<key>', 'Dot-notation key (e.g. dns.forward)')
    .argument('<value>', 'New value')
    .action(async (key: string, value: string) => {
      try {
        await setConfigValue(key, value);
        log.success(`${key} = ${value}`);
      } catch (err) {
        log.error((err as Error).message);
        process.exit(1);
      }
    });
}
