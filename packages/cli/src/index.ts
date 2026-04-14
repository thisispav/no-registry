#!/usr/bin/env node
import { Command } from 'commander';
import { registerInstall } from './commands/install.js';
import { registerUpgrade } from './commands/upgrade.js';
import { registerInit } from './commands/init.js';
import { registerConfig } from './commands/config.js';
import { registerStart } from './commands/start.js';
import { registerStop } from './commands/stop.js';
import { registerRestart } from './commands/restart.js';
import { registerStatus } from './commands/status.js';
import { registerLogs } from './commands/logs.js';
import { registerResolve } from './commands/resolve.js';
import { registerTest } from './commands/test.js';
import { registerVersion } from './commands/version.js';

const program = new Command();

program
  .name('pkdns')
  .description('Manage pkdns — a self-sovereign DNS server on Mainline DHT')
  .version('0.1.0', '-V, --version', 'Show pkdns-cli version');

registerInstall(program);
registerUpgrade(program);
registerInit(program);
registerConfig(program);
registerStart(program);
registerStop(program);
registerRestart(program);
registerStatus(program);
registerLogs(program);
registerResolve(program);
registerTest(program);
registerVersion(program);

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error((err as Error).message ?? err);
  process.exit(1);
});
