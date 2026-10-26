import { useState } from 'react';
import { SPACES, spaceTotal } from '../../../shared/src';
import type { RestoreStep } from '../../../shared/src';
import { Icon } from '../art';
import { sfx } from '../audio';
import { useT } from '../i18n';
import { needServer, pushToast, showDialog, useStore } from '../store';
import type { DialogLine } from '../store';
import { buyStep } from '../story';
import { BricksGem, StoryIcon } from '../components/StoryUI';

/**
 * Restoration: a flat, layered 2D scene. Under everything lies the ruined space (story/<space>/base.webp); every
 * finished step lays its own full-size transparent layer on top (story/<space>/<step>.webp, or <step>-<choice>.webp
 * for a step with designs). Missing art shows as a labelled plaque at the step's spot, so the flow works before the
 * pictures exist. Bricks are spent on the server.
 */

/** Where each step sits in the scene (percent of the scene's width / height): its plaque, and the next-step button. */
const SPOT: Record<string, [number, number]> = {
  rubble: [50, 86], door: [50, 64], portal: [50, 40], lamps: [22, 30], hall1: [78, 56],
  pool: [50, 78], cases: [20, 60], ceiling: [50, 12], hall2: [80, 30], opening: [50, 52],
};

function Layer({ src, onMissing }: { src: string; onMissing: () => void }) {
  return <img className="rs-layer" src={src} alt="" draggable={false} onError={onMissing} />;
}

export default function RestoreScreen() {
  const t = useT();
  const story = useStore((s) => s.story);
  const [picking, setPicking] = useState<{ no: number; step: RestoreStep; change: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState<Record<string, boolean>>({});
  const space = SPACES[0];
  const base = `${import.meta.env.BASE_URL}story/${space.id}/`;
  const sp = story.steps[space.id] ?? { done: 0, choices: {} };
  const next = space.steps[sp.done];
  const layerSrc = (st: RestoreStep) => base + st.id + (st.choices ? `-${sp.choices[st.id] ?? 0}` : '') + '.webp';
  const name = (st: RestoreStep) => t(`story.${space.id}.step.${st.id}`);
  const lines = (st: RestoreStep): DialogLine[] => [
    { who: 'master', key: `story.${space.id}.${st.id}.a`, mood: 'happy' },
    { who: 'grandchild', key: `story.${space.id}.${st.id}.b` },
  ];

  const pay = async (no: number, choice?: number, change = false) => {
    if (!needServer('off.what.restore')) return;
    setBusy(true);
    const r = await buyStep(space.id, no, choice);
    setBusy(false);
    setPicking(null);
    if (r === true) {
      sfx.bonus();
      if (!change) showDialog(lines(space.steps[no - 1]), sp.done + 1 === space.steps.length ? () => pushToast(t('story.spaceDone'), 'good') : undefined);
    } else if (r !== 'offline') pushToast(t('story.err.' + r), 'bad');
  };
  const start = () => {
    if (!next) return;
    if (story.bricks < next.cost) { sfx.bad(); pushToast(t('story.needBricks', { n: next.cost - story.bricks }), 'warn'); return; }
    if (next.choices) setPicking({ no: sp.done + 1, step: next, change: false });
    else void pay(sp.done + 1);
  };
  const spent = space.steps.slice(0, sp.done).reduce((n, s) => n + s.cost, 0);

  return (
    <main className="screen restorescreen">
      <header className="maptop">
        <button className="iconbtn" onClick={() => useStore.setState({ screen: 'map' })} aria-label={t('mm.back')}><Icon id="back" size={30} /></button>
        <h2>{t(`story.${space.id}.name`)}</h2>
        <BricksGem />
      </header>
      <div className="rs-scene">
        {!missing.base ? <Layer src={base + 'base.webp'} onMissing={() => setMissing((m) => ({ ...m, base: true }))} /> : <div className="rs-placeholder">{t('story.artPending')}</div>}
        {space.steps.slice(0, sp.done).map((st) => {
          const src = layerSrc(st);
          if (!missing[src]) return <Layer key={src} src={src} onMissing={() => setMissing((m) => ({ ...m, [src]: true }))} />;
          const [x, y] = SPOT[st.id] ?? [50, 50];
          return (
            <button key={src} className="rs-plaque done" style={{ left: `${x}%`, top: `${y}%` }} onClick={() => st.choices && setPicking({ no: space.steps.indexOf(st) + 1, step: st, change: true })}>
              <Icon id="confirm" size={16} />{name(st)}{st.choices ? ` · ${(sp.choices[st.id] ?? 0) + 1}` : ''}
            </button>
          );
        })}
        {next && (() => {
          const [x, y] = SPOT[next.id] ?? [50, 50];
          return (
            <button className={'rs-next' + (story.bricks >= next.cost ? ' ready' : '')} style={{ left: `${x}%`, top: `${y}%` }} onClick={start} disabled={busy} aria-label={name(next)}>
              <StoryIcon id="brick" size={22} /><b className="num">{next.cost}</b>
            </button>
          );
        })()}
      </div>
      <section className="rs-panel">
        <div className="rs-progress"><div style={{ width: `${(100 * spent) / spaceTotal(space)}%` }} /><span className="num">{sp.done}/{space.steps.length}</span></div>
        {next ? (
          <div className="rs-card">
            <div><b>{name(next)}</b><small className="muted">{t(next.choices ? 'story.stepChoice' : 'story.stepPlain', { n: next.choices })}</small></div>
            <button className="btn primary" disabled={busy} onClick={start}><StoryIcon id="brick" size={20} /> <span className="num">{next.cost}</span></button>
          </div>
        ) : <div className="rs-card done"><b>{t('story.spaceDone')}</b></div>}
        {space.steps.some((s, i) => s.choices && i < sp.done) && <p className="muted small">{t('story.changeHint')}</p>}
      </section>
      {picking && (
        <div className="overlay" onClick={() => setPicking(null)}>
          <div className="modal small" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <h3>{name(picking.step)}</h3>
            <button className="mclose" onClick={() => setPicking(null)} aria-label={t('settings.close')}>✕</button>
            <div className="mscroll">
              <p className="dlg-text">{t('story.pick')}</p>
              <div className="rs-choices">
                {Array.from({ length: picking.step.choices }, (_, i) => {
                  const thumb = `${base}${picking.step.id}-${i}-thumb.webp`;
                  const cur = picking.change && (sp.choices[picking.step.id] ?? 0) === i;
                  return (
                    <button key={i} className={'rs-choice' + (cur ? ' cur' : '')} disabled={busy} onClick={() => void pay(picking.no, i, picking.change)}>
                      {!missing[thumb] ? <img src={thumb} alt="" onError={() => setMissing((m) => ({ ...m, [thumb]: true }))} /> : <span className={'rs-swatch s' + i}>{i + 1}</span>}
                      <small>{t(`story.${space.id}.${picking.step.id}.opt${i}`)}</small>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
