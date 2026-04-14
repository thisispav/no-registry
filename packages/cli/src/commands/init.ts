import type { Command } from 'commander';
import { log } from '@clack/prompts';
import { runSetupWizard } from '../prompts/setup-wizard.js';

export function registerInit(program: Command): void {
  program
    .command('init')
    .description('Interactive setup wizard — configure and start pkdns')
    .action(async () => {
      try {
        await runSetupWizard();
      } catch (err) {
        log.error((err as Error).message);
        process.exit(1);
      }
    });
}
