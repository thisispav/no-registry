export interface GithubAsset {
  name: string;
  browser_download_url: string;
  size: number;
  content_type: string;
}

export interface GithubRelease {
  tag_name: string;
  name: string;
  published_at: string;
  assets: GithubAsset[];
  body: string;
}
