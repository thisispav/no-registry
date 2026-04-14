import { createHash } from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { getLatestRelease, getReleaseByTag } from './github.js';
import { getBinaryAssetName, getChecksumAssetName } from './platform.js';
import { BINARY_PATH, BIN_DIR, VERSION_FILE } from './paths.js';

const execFileAsync = promisify(execFile);

export interface InstalledVersion {
  version: string;
  platform: string;
  installedAt: string;
}

export async function isBinaryInstalled(): Promise<boolean> {
  try {
    await fs.promises.access(BINARY_PATH, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export async function getInstalledVersion(): Promise<string | null> {
  try {
    const raw = await fs.promises.readFile(VERSION_FILE, 'utf-8');
    const data = JSON.parse(raw) as InstalledVersion;
    return data.version;
  } catch {
    return null;
  }
}

export function getBinaryPath(): string {
  return BINARY_PATH;
}

async function downloadToTemp(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'pkdns-cli' },
  });
  if (!res.ok) {
    throw new Error(`Failed to download ${url}: ${res.status} ${res.statusText}`);
  }

  const tmpFile = path.join(os.tmpdir(), `pkdns-download-${Date.now()}-${path.basename(url)}`);
  const buffer = await res.arrayBuffer();
  await fs.promises.writeFile(tmpFile, Buffer.from(buffer));
  return tmpFile;
}

async function verifySha256(filePath: string, expected: string): Promise<void> {
  const data = await fs.promises.readFile(filePath);
  const actual = createHash('sha256').update(data).digest('hex');
  if (actual.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(
      `SHA256 checksum mismatch!\n  Expected: ${expected}\n  Got:      ${actual}`
    );
  }
}

async function parseChecksumsFile(content: string, filename: string): Promise<string | null> {
  for (const line of content.split('\n')) {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 2 && parts[1].endsWith(filename)) {
      return parts[0];
    }
  }
  return null;
}

async function extractTarball(tarPath: string, destDir: string): Promise<void> {
  await fs.promises.mkdir(destDir, { recursive: true });
  await execFileAsync('tar', ['-xzf', tarPath, '-C', destDir]);
}

async function findBinaryInDir(dir: string, binaryName: string): Promise<string | null> {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = await findBinaryInDir(fullPath, binaryName);
      if (found) return found;
    } else if (entry.name === binaryName && entry.isFile()) {
      return fullPath;
    }
  }
  return null;
}

export async function downloadBinary(version?: string): Promise<void> {
  const release = version ? await getReleaseByTag(version) : await getLatestRelease();
  const tag = release.tag_name;
  const assetName = getBinaryAssetName(tag);
  const checksumName = getChecksumAssetName(tag);

  const binaryAsset = release.assets.find((a) => a.name === assetName);
  if (!binaryAsset) {
    throw new Error(
      `No binary found for your platform in release ${tag}.\nLooking for: ${assetName}\nAvailable: ${release.assets.map((a) => a.name).join(', ')}`
    );
  }

  const checksumAsset = release.assets.find((a) => a.name === checksumName);

  const tmpTar = await downloadToTemp(binaryAsset.browser_download_url);

  try {
    if (checksumAsset) {
      const tmpChecksum = await downloadToTemp(checksumAsset.browser_download_url);
      try {
        const checksumContent = await fs.promises.readFile(tmpChecksum, 'utf-8');
        const expectedHash = await parseChecksumsFile(checksumContent, assetName);
        if (expectedHash) {
          await verifySha256(tmpTar, expectedHash);
        }
      } finally {
        await fs.promises.unlink(tmpChecksum).catch(() => {});
      }
    }

    await fs.promises.mkdir(BIN_DIR, { recursive: true });
    await extractTarball(tmpTar, BIN_DIR);

    const binaryName = process.platform === 'win32' ? 'pkdns.exe' : 'pkdns';
    const extractedBinary = await findBinaryInDir(BIN_DIR, binaryName);
    if (!extractedBinary) {
      throw new Error(`Could not find "${binaryName}" binary after extraction in ${BIN_DIR}`);
    }

    if (extractedBinary !== BINARY_PATH) {
      await fs.promises.rename(extractedBinary, BINARY_PATH);
    }

    await fs.promises.chmod(BINARY_PATH, 0o755);

    // Clean up any leftover extracted subdirectories
    const entries = await fs.promises.readdir(BIN_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        await fs.promises.rm(path.join(BIN_DIR, entry.name), { recursive: true, force: true });
      }
    }

    const meta: InstalledVersion = {
      version: tag,
      platform: getBinaryAssetName(tag).replace(`.tar.gz`, ''),
      installedAt: new Date().toISOString(),
    };
    await fs.promises.writeFile(VERSION_FILE, JSON.stringify(meta, null, 2));
  } finally {
    await fs.promises.unlink(tmpTar).catch(() => {});
  }
}
