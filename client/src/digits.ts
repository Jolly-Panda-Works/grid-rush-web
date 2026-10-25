import { useStore } from './store';

/**
 * Persian digits: while the UI is in Persian every number on screen is shown with ۰-۹. Instead of touching every
 * place a number is rendered, the text of the page is converted as React writes it (a MutationObserver); inputs and
 * anything marked `data-latin` (codes the player has to type, like the friend code) keep Latin digits, and so does
 * text with Latin letters in it (names, the version).
 * Numbers drawn on canvases go through `localDigits`.
 */
const FA = '۰۱۲۳۴۵۶۷۸۹';
const LATIN_RE = /[0-9]/g;
const HAS_LATIN = /[0-9]/;
const FA_RE = /[۰-۹]/g;
export const toFaDigits = (s: string) => s.replace(LATIN_RE, (d) => FA[+d]);
const toLatinDigits = (s: string) => s.replace(FA_RE, (d) => String(FA.indexOf(d)));

/** For text drawn outside the DOM (canvas textures): Persian digits when the UI is Persian. */
export const localDigits = (s: string) => (useStore.getState().settings.lang === 'fa' ? toFaDigits(s) : s);

/** Latin text keeps its digits too: player names like "Player715", the version "v0.15.0", "XP". */
const LATIN_WORD = /[A-Za-z]/;
const keepLatin = (node: Node) => LATIN_WORD.test(node.nodeValue ?? '') || !!node.parentElement?.closest('input, textarea, script, style, [data-latin]');

function convertText(n: Node, fn: (s: string) => string) {
  const v = n.nodeValue;
  if (v && !keepLatin(n)) { const w = fn(v); if (w !== v) n.nodeValue = w; }
}
function convertTree(root: Node, fn: (s: string) => string) {
  if (root.nodeType === Node.TEXT_NODE) { convertText(root, fn); return; } // a walker never visits its own root
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) convertText(n, fn);
}

let observer: MutationObserver | null = null;
function setPersian(on: boolean) {
  if (on && !observer) {
    observer = new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === 'characterData') {
          const v = r.target.nodeValue;
          if (v && HAS_LATIN.test(v) && !keepLatin(r.target)) r.target.nodeValue = toFaDigits(v); // only rewrites when there is a Latin digit, so it settles
        } else r.addedNodes.forEach((n) => convertTree(n, toFaDigits));
      }
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    convertTree(document.body, toFaDigits);
  } else if (!on && observer) {
    observer.disconnect();
    observer = null;
    convertTree(document.body, toLatinDigits);
  }
}

/** Follow the UI language from now on. */
export function installPersianDigits() {
  setPersian(useStore.getState().settings.lang === 'fa');
  useStore.subscribe((s, prev) => { if (s.settings.lang !== prev.settings.lang) setPersian(s.settings.lang === 'fa'); });
}
