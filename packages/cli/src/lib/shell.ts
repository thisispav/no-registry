import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { BIN_DIR } from './paths.js';

const MARKER = '# Added by pkdns installer';

function shellRcFile(): string {
  const shell = process.env.SHELL ?? '';
  const home = os.homedir();

  if (shell.endsWith('zsh')) return path.join(home, '.zshrc');
  if (shell.endsWith('bash')) {
    // macOS bash conventionally uses .bash_profile; Linux uses .bashrc
    return process.platform === 'darwin'
      ? path.join(home, '.bash_profile')
      : path.join(home, '.bashrc');
  }
  if (shell.endsWith('fish')) return path.join(home, '.config', 'fish', 'config.fish');
  return path.join(home, '.profile');
}

function pathLine(shell: string): string {
  if (shell.endsWith('fish')) {
    return `fish_add_path "${BIN_DIR}"`;
  }
  return `export PATH="${BIN_DIR}:$PATH"`;
}

/**
 * Appends BIN_DIR to the user's shell rc file if not already present.
 * Returns the rc file path and whether the entry was newly added.
 */
export async function addBinToPath(): Promise<{ rcFile: string; added: boolean }> {
  const rcFile = shellRcFile();
  const shell = process.env.SHELL ?? '';
  const line = pathLine(shell);

  // Already effective in the current session — no-op.
  const currentPath = (process.env.PATH ?? '').split(':');
  if (currentPath.includes(BIN_DIR)) {
    return { rcFile, added: false };
  }

  let contents = '';
  try {
    contents = await fs.readFile(rcFile, 'utf8');
  } catch {
    // rc file doesn't exist yet; appendFile will create it
  }

  if (contents.includes(BIN_DIR)) {
    return { rcFile, added: false };
  }

  await fs.appendFile(rcFile, `\n${MARKER}\n${line}\n`, 'utf8');
  return { rcFile, added: true };
}
