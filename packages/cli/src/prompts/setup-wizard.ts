import { intro, outro, spinner, log, note } from '@clack/prompts';
import { navigableSelect, navigableConfirm } from './navigable.js';
import { runBinaryPrompt } from './binary-prompt.js';
import { runConfigPrompt } from './config-prompt.js';
import { isDockerAvailable, ensureComposeFile, dockerUp } from '../lib/docker.js';
import { readConfig, writeConfig, writeCliMeta } from '../lib/config.js';
import { startDaemon } from '../lib/process.js';
import type { RunMode } from '../types/config.js';

export async function runSetupWizard(): Promise<void> {
  intro('pkdns setup');

  // Step 1: choose run mode
  const mode = await navigableSelect<RunMode>({
    message: 'How do you want to run pkdns?',
    options: [
      { value: 'binary', label: 'Binary', hint: 'Download pre-built binary — recommended' },
      { value: 'docker', label: 'Docker', hint: 'Use Docker Compose' },
    ],
    initialValue: 'binary',
  });

  // Step 2a: binary setup
  if (mode === 'binary') {
    await runBinaryPrompt();
  }

  // Step 2b: Docker setup
  if (mode === 'docker') {
    const dockerOk = await isDockerAvailable();
    if (!dockerOk) {
      log.error('Docker is not available. Install Docker Desktop and try again.');
      process.exit(1);
    }

    const s = spinner();
    s.start('Fetching compose.yaml…');
    try {
      await ensureComposeFile();
      s.stop('compose.yaml ready');
    } catch (err) {
      s.stop('Failed to fetch compose.yaml');
      throw err;
    }
  }

  // Step 3: configure pkdns
  const existing = await readConfig();
  const pkdnsConfig = await runConfigPrompt(existing);
  await writeConfig(pkdnsConfig);
  await writeCliMeta({ mode });
  log.success('Configuration saved to ~/.pkdns/pkdns.toml');

  // Port 53 warning for binary mode
  if (mode === 'binary' && pkdnsConfig.general?.socket?.endsWith(':53')) {
    if (typeof process.getuid === 'function' && process.getuid() !== 0) {
      log.warn('Binding to port 53 requires root. Use: sudo pkdns start');
    }
  }

  // Step 4: optionally start
  const startNow = await navigableConfirm({
    message: 'Start pkdns now?',
    initialValue: true,
  });

  if (startNow) {
    const s = spinner();
    if (mode === 'binary') {
      s.start('Starting pkdns…');
      try {
        const pid = await startDaemon({});
        s.stop(`pkdns running (PID ${pid})`);
      } catch (err) {
        s.stop('Failed to start pkdns');
        throw err;
      }
    } else {
      s.start('Running docker compose up -d…');
      try {
        await dockerUp({ detach: true });
        s.stop('pkdns container started');
      } catch (err) {
        s.stop('Failed to start Docker container');
        throw err;
      }
    }
  }

  note(
    [
      'pkdns status           → check if running',
      'pkdns resolve <domain> → test DNS resolution',
      'pkdns config show      → view configuration',
      'pkdns logs             → view logs',
    ].join('\n'),
    'Next steps'
  );

  outro('pkdns is set up!');
}
