import type { GithubRelease } from '../types/github.js';

const REPO = 'pubky/pkdns';
const API_BASE = `https://api.github.com/repos/${REPO}`;

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'pkdns-cli',
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: getHeaders() });

  if (res.status === 403 || res.status === 429) {
    const remaining = res.headers.get('x-ratelimit-remaining');
    if (remaining === '0') {
      const reset = res.headers.get('x-ratelimit-reset');
      const resetDate = reset ? new Date(Number(reset) * 1000).toLocaleTimeString() : 'unknown';
      throw new Error(
        `GitHub API rate limit exceeded. Resets at ${resetDate}. Set GITHUB_TOKEN env var for higher limits.`
      );
    }
  }

  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}

export async function getLatestRelease(): Promise<GithubRelease> {
  return fetchJson<GithubRelease>(`${API_BASE}/releases/latest`);
}

export async function getReleaseByTag(tag: string): Promise<GithubRelease> {
  return fetchJson<GithubRelease>(`${API_BASE}/releases/tags/${tag}`);
}

export async function listReleases(): Promise<GithubRelease[]> {
  return fetchJson<GithubRelease[]>(`${API_BASE}/releases?per_page=20`);
}
