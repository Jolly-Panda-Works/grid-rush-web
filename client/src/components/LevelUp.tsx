import { useEffect, useState } from 'react';
import { levelProgress } from '../../../shared/src';
import { sfx } from '../audio';
import { useT } from '../i18n';
import { Medal } from './Medal';

/** Full-screen level-up moment: light rays and gold sparks behind the player's medallion, the level star counting
 *  up from the old level to the new one, then the XP bar of the new level filling. */
export function LevelUp({ from, to, xp, avatar, onClose }: { from: number; to: number; xp: number; avatar: number; onClose: () => void }) {
  const t = useT();
  const [lv, setLv] = useState(from);
  useEffect(() => {
    sfx.bonus();
    if (lv >= to) return;
    const tm = setTimeout(() => setLv((n) => n + 1), lv === from ? 700 : 350);
    return () => clearTimeout(tm);
  }, [lv]); // eslint-disable-line react-hooks/exhaustive-deps
  const lp = levelProgress(xp);
  return (
    <div className="overlay levelup" onClick={onClose} role="dialog" aria-modal="true" aria-label={t('res.levelUp')}>
      <div className="lu-rays" aria-hidden="true" />
      <div className="lu-sparks" aria-hidden="true">{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ '--a': `${i * (360 / 14)}deg`, '--d': `${(i % 5) * 0.12}s` } as React.CSSProperties} />)}</div>
      <div className="lu-body" onClick={(e) => e.stopPropagation()}>
        <h2 className="lu-title">{t('res.levelUp')}</h2>
        <div className="lu-medal"><Medal size={132} avatar={avatar} /><span key={lv} className="lu-star num">{lv}</span></div>
        <p className="lu-text">{t('lvl.reached', { n: to })}</p>
        <div className="lu-xp num"><div style={{ width: `${Math.min(100, lp.ratio * 100)}%` }} /><span>{lp.into}/{lp.needed} XP</span></div>
        <button className="btn primary big" onClick={onClose}>{t('lvl.continue')}</button>
      </div>
    </div>
  );
}
