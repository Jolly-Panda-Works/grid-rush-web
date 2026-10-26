import { useEffect } from 'react';
import { Icon, IconId } from '../art';
import { sfx } from '../audio';
import { useT } from '../i18n';
import { backToMenu, startSearch } from '../net';
import { useStore } from '../store';
import { markTutorialDone, tutorialStep, TutStep } from '../tutorial';

const ICON: Record<TutStep, IconId> = { buy: 'buy-tile', wait: 'turns', rotate: 'rotate-right', advance: 'advance', coins: 'treasure', reward: 'gift', done: 'trophy' };

/** The coach of the first-launch tutorial: one short instruction per step, and the part of the table it is about
 *  glows (body[data-tut]). The session itself only lets the taught move through (tutorial.ts). */
export function TutorialCoach() {
  const t = useT();
  const tut = useStore((s) => s.tutorial);
  const g = useStore((s) => s.game);
  const me = useStore((s) => s.mySeat);
  const step = tut && g ? tutorialStep(g, me, tut.coinsSeen) : null;
  useEffect(() => {
    if (step) document.body.dataset.tut = step; else delete document.body.dataset.tut;
    if (step === 'done') { markTutorialDone(); sfx.achievement(); }
    return () => { delete document.body.dataset.tut; };
  }, [step]);
  if (!step || !g) return null;
  const n = ['buy', 'rotate', 'advance', 'coins', 'reward', 'done'].indexOf(step);
  return (
    <div className={'coach s-' + step} role="status" aria-live="polite">
      <div className="coach-card">
        <Icon id={ICON[step]} size={44} className="coach-ico" />
        <div className="coach-body">
          {n >= 0 && <span className="coach-step num">{t('tut.step', { n: n + 1, of: 6 })}</span>}
          <b>{t('tut.' + step + '.t')}</b>
          <p>{t('tut.' + step + '.d')}</p>
          {step === 'coins' && <button className="btn primary small" onClick={() => useStore.setState({ tutorial: { coinsSeen: true } })}>{t('tut.next')}</button>}
          {step === 'done' && (
            <div className="row">
              <button className="btn primary small" onClick={() => startSearch(true)}>{t('tut.play')}</button>
              <button className="btn small" onClick={backToMenu}>{t('res.menu')}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
