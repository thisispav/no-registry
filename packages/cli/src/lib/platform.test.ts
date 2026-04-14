import { describe, it, expect } from 'bun:test';
import { detectPlatform, getBinaryAssetName, getChecksumAssetName } from './platform.js';

describe('detectPlatform', () => {
  it('returns a valid platform string', () => {
    const platform = detectPlatform();
    expect(platform).toMatch(/^(linux|osx|windows)-(amd64|arm64)$/);
  });
});

describe('getBinaryAssetName', () => {
  it('includes the version tag', () => {
    const name = getBinaryAssetName('v0.7.1');
    expect(name).toContain('v0.7.1');
    expect(name).toEndWith('.tar.gz');
  });

  it('includes the current platform', () => {
    const platform = detectPlatform();
    const name = getBinaryAssetName('v0.7.1');
    expect(name).toContain(platform);
  });
});

describe('getChecksumAssetName', () => {
  it('includes the version tag', () => {
    const name = getChecksumAssetName('v0.7.1');
    expect(name).toContain('v0.7.1');
    expect(name).toContain('sha256');
  });
});
