import { useEffect, useState } from 'react';
import { sfx } from '../audio';
import { useT } from '../i18n';
import { useStore } from '../store';
import { TileShape } from './TileShape';

/** The 1x1 reward tile drawn as a card, in the same style as the hand. */
export function RewardCardFace({ count = 1 }: { count?: number }) {
  const t = useT();
  return (
    <>
      <span className="cart"><TileShape cells={[[0, 0]]} shape="mono" uid={0} cell={34} /><b className="r11">1×1</b></span>
      <span className="cribbon rib-reward">{t('reward.ribbon')}</span>
      {count > 1 && <span className="cgem rcount num">×{count}</span>}
    </>
  );
}

/** When a player collects a 1x1 tile, its card appears in the middle of the table with light rays,
 *  then flies to that player's side (mine: into my hand, where I place it; the opponent's: up to their bar). */
export function RewardCardFx() {
  const t = useT();
  const r = useStore((s) => s.rewardCard);
  const mySeat = useStore((s) => s.mySeat);
  const opp = useStore((s) => (s.game ? s.game.players[1 - s.mySeat].name : ''));
  const [phase, setPhase] = useState<'in' | 'out' | null>(null);
  useEffect(() => {
    if (!r) return;
    setPhase('in');
    if (r.seat === mySeat) sfx.bonus(); else sfx.coin();
    const t1 = setTimeout(() => setPhase('out'), 1500);
    const t2 = setTimeout(() => { setPhase(null); useStore.setState((s) => (s.rewardCard?.id === r.id ? { rewardCard: null } : {})); }, 1950);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [r, mySeat]);
  if (!r || !phase) return null;
  const mine = r.seat === mySeat;
  return (
    <div className={`rewardfx ${phase} ${mine ? 'mine' : 'opp'}`} aria-live="assertive">
      <div className="rays" aria-hidden="true" />
      <div className="gcard rewardcard"><RewardCardFace /></div>
      <div className="rewardtitle">
        <b>{mine ? t('reward.title') : t('reward.opp', { name: opp })}</b>
        {mine && <small>{t('reward.sub')}</small>}
      </div>
    </div>
  );
}
