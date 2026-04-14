export type OS = 'linux' | 'osx' | 'windows';
export type Arch = 'amd64' | 'arm64';
export type Platform = `${OS}-${Arch}`;

const OS_MAP: Record<string, OS> = {
  linux: 'linux',
  darwin: 'osx',
  win32: 'windows',
};

const ARCH_MAP: Record<string, Arch> = {
  x64: 'amd64',
  arm64: 'arm64',
};

export function detectPlatform(): Platform {
  const mappedOs = OS_MAP[process.platform];
  const mappedArch = ARCH_MAP[process.arch];

  if (!mappedOs || !mappedArch) {
    throw new Error(`Unsupported platform: ${process.platform}/${process.arch}`);
  }
  return `${mappedOs}-${mappedArch}`;
}

export function getBinaryAssetName(version: string): string {
  const platform = detectPlatform();
  return `pkdns-${version}-${platform}.tar.gz`;
}

export function getChecksumAssetName(version: string): string {
  return `pkdns-${version}-sha256sums.txt`;
}
