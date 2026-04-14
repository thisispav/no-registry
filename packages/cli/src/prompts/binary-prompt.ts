import { spinner, log } from '@clack/prompts';
import { isBinaryInstalled, downloadBinary, getInstalledVersion } from '../lib/binary.js';
import { getLatestRelease } from '../lib/github.js';
import { navigableConfirm, navigableText } from './navigable.js';
import { addBinToPath } from '../lib/shell.js';

export async function runBinaryPrompt(opts: { force?: boolean } = {}): Promise<string> {
  const already = await isBinaryInstalled();
  const installedVersion = already ? await getInstalledVersion() : null;

  if (already && !opts.force) {
    log.success(`pkdns binary already installed (${installedVersion ?? 'unknown version'})`);
    return installedVersion ?? 'installed';
  }

  let version: string | undefined;

  const useLatest = await navigableConfirm({
    message: 'Install the latest pkdns release?',
    initialValue: true,
  });

  if (!useLatest) {
    const customVersion = await navigableText({
      message: 'Enter version tag to install (e.g. v0.7.1):',
      placeholder: 'v0.7.1',
      validate: (v) => {
        if (!v || !v.startsWith('v')) return 'Version must start with "v" (e.g. v0.7.1)';
      },
    });
    version = customVersion;
  }

  const s = spinner();
  s.start(`Fetching release info${version ? ` for ${version}` : ' (latest)'}…`);

  let tag: string;
  try {
    const release = version
      ? await (await import('../lib/github.js')).getReleaseByTag(version)
      : await getLatestRelease();
    tag = release.tag_name;
    s.message(`Downloading pkdns ${tag}…`);
    await downloadBinary(version);
    s.stop(`pkdns ${tag} installed successfully`);

    const { rcFile, added } = await addBinToPath();
    if (added) {
      log.info(`Added pkdns to PATH in ${rcFile} — run: source ${rcFile}`);
    }
  } catch (err) {
    s.stop('Download failed');
    throw err;
  }

  return tag;
}
