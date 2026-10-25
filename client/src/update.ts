import { isNative } from './device';
import { useStore } from './store';

/**
 * Update check on launch: compares this build's version with the latest GitHub release.
 * - Android app: opens the store page (VITE_STORE_URL, once the game is on a store) or else downloads the new APK
 *   from the release; it installs over the old one because every build is signed with the same key.
 * - Web: the new build is already on the host, so updating is a reload that skips the cache.
 */
const REPO = import.meta.env.VITE_UPDATE_REPO || 'Jolly-Panda-Works/grid-rush-web';
const STORE_URL = import.meta.env.VITE_STORE_URL || '';
const SKIP_KEY = 'gridrush.update.skip';

export interface UpdateInfo { version: string; url: string; kind: 'store' | 'apk' | 'reload'; notes: string[] }

/** -1 / 0 / 1 for semantic versions like "0.9.0" (a "-dev.N" suffix counts as older than the plain version). */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) => { const [core, pre] = v.replace(/^v/, '').split('-'); return { n: core.split('.').map((x) => parseInt(x, 10) || 0), pre: !!pre }; };
  const x = parse(a), y = parse(b);
  for (let i = 0; i < 3; i++) if ((x.n[i] ?? 0) !== (y.n[i] ?? 0)) return (x.n[i] ?? 0) < (y.n[i] ?? 0) ? -1 : 1;
  return x.pre === y.pre ? 0 : x.pre ? -1 : 1;
}

interface Release { tag_name: string; body?: string; draft: boolean; prerelease: boolean; assets: { name: string; browser_download_url: string }[] }

export async function checkForUpdate(): Promise<void> {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 6000);
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { signal: ctl.signal, headers: { Accept: 'application/vnd.github+json' } });
    clearTimeout(timer);
    if (!r.ok) return;
    const rel = (await r.json()) as Release;
    if (rel.draft || rel.prerelease) return;
    const latest = rel.tag_name.replace(/^v/, '');
    if (compareVersions(__APP_VERSION__, latest) >= 0) return;
    try { if (localStorage.getItem(SKIP_KEY) === latest) return; } catch { /* ignore */ }
    let info: UpdateInfo;
    if (isNative()) {
      // signed release APK if the release has one, otherwise the debug APK (all builds share one signing key per flavour)
      const apk = rel.assets.find((a) => /-Android\.apk$/.test(a.name)) ?? rel.assets.find((a) => /-Android-debug\.apk$/.test(a.name));
      if (STORE_URL) info = { version: latest, url: STORE_URL, kind: 'store', notes: [] };
      else if (apk) info = { version: latest, url: apk.browser_download_url, kind: 'apk', notes: [] };
      else return;
    } else info = { version: latest, url: '', kind: 'reload', notes: [] };
    // the first few "What's changed" lines of the release notes
    // e.g. "- **ui:** card-game table ([`dd32ebb`](https://…))" -> "card-game table"
    info.notes = (rel.body ?? '').split('\n').map((l) => l.trim()).filter((l) => /^[-*] /.test(l)).map((l) => l
      .replace(/^[-*] /, '')
      .replace(/\s*\(\[`?[0-9a-f]{7,}`?\]\([^)]*\)\)/g, '')
      .replace(/^\*\*[^*]*?:\*\*\s*/, '')
      .replace(/\*\*|`/g, '')
      .trim()).filter(Boolean).slice(0, 4);
    useStore.setState({ update: info });
  } catch { /* offline or rate-limited: try again next launch */ }
}

export function applyUpdate(u: UpdateInfo) {
  if (u.kind === 'reload') {
    const url = new URL(location.href);
    url.searchParams.set('v', u.version); // a new URL skips the cached page
    location.replace(url.toString());
    return;
  }
  // inside the Android app, navigating to an outside URL opens it in the system browser / store app
  location.href = u.url;
}

export function skipUpdate(u: UpdateInfo) {
  try { localStorage.setItem(SKIP_KEY, u.version); } catch { /* ignore */ }
  useStore.setState({ update: null });
}
