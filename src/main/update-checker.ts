import { promises as fs } from "node:fs";
import path from "node:path";

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  releaseUrl: string;
}

interface GitHubRelease {
  tag_name?: unknown;
  html_url?: unknown;
  draft?: unknown;
  prerelease?: unknown;
}

interface CachedRelease {
  checkedAt: number;
  release: GitHubRelease;
}

export interface UpdateCheckerOptions {
  currentVersion: string;
  cacheDirectory: string;
  repository: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
  cacheTtlMs?: number;
}

const DEFAULT_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

function versionParts(value: string): number[] | null {
  const normalized = value.trim().replace(/^v/i, "").split("-")[0];
  if (!/^\d+(?:\.\d+)*$/.test(normalized)) return null;
  return normalized.split(".").map(Number);
}

export function isNewerVersion(candidate: string, current: string): boolean {
  const next = versionParts(candidate);
  const installed = versionParts(current);
  if (!next || !installed) return false;
  const length = Math.max(next.length, installed.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (next[index] ?? 0) - (installed[index] ?? 0);
    if (difference !== 0) return difference > 0;
  }
  return false;
}

function toUpdateInfo(release: GitHubRelease, currentVersion: string, repository: string): UpdateInfo | null {
  if (release.draft === true || release.prerelease === true) return null;
  if (typeof release.tag_name !== "string" || typeof release.html_url !== "string") return null;
  if (!isNewerVersion(release.tag_name, currentVersion)) return null;
  const expectedPrefix = `https://github.com/${repository}/releases/`;
  if (!release.html_url.startsWith(expectedPrefix)) return null;
  return {
    currentVersion,
    latestVersion: release.tag_name.replace(/^v/i, ""),
    releaseUrl: release.html_url
  };
}

export async function checkForUpdate(options: UpdateCheckerOptions): Promise<UpdateInfo | null> {
  const now = options.now ?? Date.now;
  const cacheFile = path.join(options.cacheDirectory, "update-check.json");
  try {
    const cached = JSON.parse(await fs.readFile(cacheFile, "utf8")) as CachedRelease;
    if (Number.isFinite(cached.checkedAt) && now() - cached.checkedAt < (options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS)) {
      return toUpdateInfo(cached.release, options.currentVersion, options.repository);
    }
  } catch {
    // Missing, expired, or invalid cache: continue with a network check.
  }

  try {
    const response = await (options.fetchImpl ?? fetch)(`https://api.github.com/repos/${options.repository}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "LoL-Matchup-Viewer" },
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) return null;
    const release = await response.json() as GitHubRelease;
    if (release.draft === true || release.prerelease === true) return null;
    try {
      await fs.mkdir(options.cacheDirectory, { recursive: true });
      await fs.writeFile(cacheFile, JSON.stringify({ checkedAt: now(), release }), "utf8");
    } catch {
      // A read-only or full cache directory must not suppress a valid update.
    }
    return toUpdateInfo(release, options.currentVersion, options.repository);
  } catch {
    return null;
  }
}
