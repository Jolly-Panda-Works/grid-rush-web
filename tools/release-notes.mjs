#!/usr/bin/env node
// Writes the top part of the GitHub Release notes (downloads table + how to use them).
// Environment: VERSION, REPO, SERVER_URL.  Reads the file names from ./release.
import { existsSync, readdirSync } from 'node:fs';

const version = process.env.VERSION || '';
const server = process.env.SERVER_URL || '';
const repo = process.env.REPO || '';
const files = existsSync('release') ? readdirSync('release').sort() : [];

const what = (f) => {
  if (f.endsWith('-Android.aab')) return 'Android App Bundle (signed): upload to Google Play';
  if (f.endsWith('-Android.apk')) return 'Android app (signed APK): install on a phone / publish';
  if (f.endsWith('-Android-debug.apk')) return 'Android debug APK: quick testing (debug-signed)';
  if (f.endsWith('-Web.zip')) return 'Web build: upload the contents to any static web host';
  if (f === 'SHA256SUMS.txt') return 'Checksums of the files above';
  return '';
};

const out = [];
out.push(`# Grid Rush v${version}`, '', '**Build Your Grid. Beat the Clock.**', '');
out.push('## Downloads', '', '| File | What it is |', '| --- | --- |');
for (const f of files) out.push(`| \`${f}\` | ${what(f)} |`);
out.push('');
if (!files.some((f) => /-Android\.(apk|aab)$/.test(f))) {
  out.push('> This release has no signed Android release file, because the repository secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD` are not set. The debug APK works for testing.', '');
}
out.push('## Online play', '');
if (server) out.push(`The apps in this release connect to \`${server}\` for online matches. "Play vs bot" always works offline.`);
else out.push('No game server address is built into this release. **Play vs bot** works offline; for online matches enter the server address in Settings (gear icon), or set the repository variable `VITE_SERVER_URL` and release again.');
out.push('', '## به فارسی', '',
  'بازی با بات بدون سرور و اینترنت کار می‌کند. برای بازی آنلاین، آدرس سرور را در تنظیمات (آیکون چرخ‌دنده) وارد کنید یا متغیر `VITE_SERVER_URL` را در ریپو تنظیم کنید.', '');
if (repo) out.push(`Verify downloads with \`sha256sum -c SHA256SUMS.txt\`. Report problems: https://github.com/${repo}/issues`, '');
console.log(out.join('\n'));
