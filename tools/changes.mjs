#!/usr/bin/env node
// Looks at the commit messages since the previous release and decides the version bump / writes the release notes.
//   node tools/changes.mjs [previousTag]           -> prints: major | minor | patch | none
//   node tools/changes.mjs [previousTag] --notes   -> prints the "What's changed" list (Markdown)
// Conventional Commits: "feat!:" or "BREAKING CHANGE" -> major, "feat:" -> minor,
// "fix:" / "perf:" / "refactor:" / "revert:" / untyped -> patch,
// only "docs:" / "chore:" / "ci:" / "test:" / "style:" / "build:" -> none (no release).
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const wantNotes = args.includes('--notes');
const previous = args.find((a) => !a.startsWith('--')) || '';
const repo = process.env.REPO || '';

const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
let raw = '';
try { raw = git('log', previous ? `${previous}..HEAD` : 'HEAD', '--no-merges', '--format=%H%x1f%s%x1f%b%x1e'); } catch { raw = ''; }

const NONE = new Set(['docs', 'chore', 'ci', 'test', 'style', 'build']);
const commits = raw.split('\x1e').map((c) => c.trim()).filter(Boolean).map((c) => {
  const [sha, subject = '', body = ''] = c.split('\x1f');
  const m = /^(\w+)(\([^)]*\))?(!)?:\s*(.+)$/.exec(subject.trim());
  const type = m ? m[1].toLowerCase() : '';
  const breaking = Boolean(m && m[3]) || /BREAKING[ -]CHANGE/.test(body);
  const kind = breaking ? 'major' : type === 'feat' ? 'minor' : NONE.has(type) ? 'none' : 'patch';
  return { sha, short: sha.slice(0, 7), type, breaking, kind, subject: (m ? m[4] : subject).trim(), scope: m && m[2] ? m[2].slice(1, -1) : '' };
}).filter((c) => !/^chore\(release\)/.test(c.type ? `${c.type}(${c.scope})` : c.subject));

if (!wantNotes) {
  const order = ['none', 'patch', 'minor', 'major'];
  console.log(commits.reduce((best, c) => (order.indexOf(c.kind) > order.indexOf(best) ? c.kind : best), 'none'));
} else {
  const link = (c) => (repo ? `[\`${c.short}\`](https://github.com/${repo}/commit/${c.sha})` : `\`${c.short}\``);
  const line = (c) => `- ${c.scope ? `**${c.scope}:** ` : ''}${c.subject} (${link(c)})`;
  const groups = [
    ['Breaking changes', (c) => c.breaking],
    ['Features', (c) => !c.breaking && c.type === 'feat'],
    ['Fixes and improvements', (c) => !c.breaking && c.type !== 'feat' && c.kind === 'patch'],
    ['Maintenance', (c) => !c.breaking && c.kind === 'none'],
  ];
  const out = ["## What's changed", ''];
  if (!commits.length) out.push('- First release.');
  for (const [title, test] of groups) {
    const items = commits.filter(test);
    if (items.length) out.push(`### ${title}`, ...items.map(line), '');
  }
  console.log(out.join('\n'));
}
