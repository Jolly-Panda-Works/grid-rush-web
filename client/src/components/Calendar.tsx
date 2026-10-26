import { useState } from 'react';
import { engravedTotal, rewardsOf, trackLen, treasuresOf } from '../../../shared/src';
import type { GameState, Seat } from '../../../shared/src';
import { useT } from '../i18n';
import { useStore } from '../store';
import { dragApi } from '../three/dragApi';
import { iconUrl } from '../three/icons';
import { avatarFor, avatarUrl } from './Medal';

/**
 * The days of a PvP game as a calendar (docs/days-and-shards.md). On phones the 3D strip shows only the days around
 * the two players; a tap on it opens this whole 9-column calendar: both players on their day, the days each has used
 * in their colour, paydays with what they pay me now, gift days still to take, and the last day.
 */
export function CalendarButton() {
  const t = useT();
  useStore((s) => s.layoutTick);
  const [open, setOpen] = useState(false);
  const r = dragApi.trackRect?.();
  if (!r?.strip) return null;
  return (
    <>
      <button className="calbtn" style={{ left: r.left, top: r.top, width: r.width, height: r.height }} onClick={() => setOpen(true)} aria-label={t('cal.open')} />
      {open && <CalendarModal onClose={() => setOpen(false)} />}
    </>
  );
}

function Face({ g, seat, mySeat }: { g: GameState; seat: Seat; mySeat: Seat }) {
  const myAvatar = useStore((s) => s.profile.avatar);
  const av = seat === mySeat ? myAvatar : avatarFor(g.players[seat].name);
  return <span className={'calface p' + seat} style={{ backgroundImage: `url(${avatarUrl(av)})` }} />;
}

function CalendarModal({ onClose }: { onClose: () => void }) {
  const t = useT();
  const g = useStore((s) => s.game)!;
  const mySeat = useStore((s) => s.mySeat);
  const len = trackLen(g);
  const pays = treasuresOf(g), gifts = rewardsOf(g);
  const wage = engravedTotal(g.players[mySeat]);
  const pos = [g.players[0].pos, g.players[1].pos];
  const days = Array.from({ length: len }, (_, k) => k + 1);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal calmodal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('cal.title')}>
        <h3>{t('cal.title')}</h3>
        <button className="mclose" onClick={onClose} aria-label={t('settings.close')}>✕</button>
        <div className="calgrid">
          {days.map((d) => {
            const used = (pos[0] >= d ? 1 : 0) | (pos[1] >= d ? 2 : 0);
            const gi = gifts.indexOf(d);
            return (
              <div key={d} className={'calday u' + used + (d === len ? ' last' : '')} title={t('cal.day', { n: d })}>
                <span className="cdn num">{d}</span>
                {pays.includes(d) && <span className="cdev pay"><img src={iconUrl('chest')} alt="" />{wage > 0 && <b className="num">+{wage}</b>}</span>}
                {gi >= 0 && !g.rewardTaken[gi] && <span className="cdev gift"><img src={iconUrl('reward')} alt="" /></span>}
                {d === len && <span className="cdev"><img src={iconUrl('flag')} alt="" /></span>}
                {([0, 1] as Seat[]).filter((s) => pos[s] === d).map((s) => <Face key={s} g={g} seat={s} mySeat={mySeat} />)}
              </div>
            );
          })}
        </div>
        {(pos[0] === 0 || pos[1] === 0) && (
          <div className="calstart muted small">
            {([0, 1] as Seat[]).filter((s) => pos[s] === 0).map((s) => <Face key={s} g={g} seat={s} mySeat={mySeat} />)}
            {t('cal.day', { n: 0 })}
          </div>
        )}
      </div>
    </div>
  );
}

/** Always on screen in PvP: whose turn it is, and why (the days both players are on). */
export function TurnLine() {
  const t = useT();
  const g = useStore((s) => s.game)!;
  const mySeat = useStore((s) => s.mySeat);
  if (g.phase === 'finished' || g.solo) return null;
  const opp = (1 - mySeat) as Seat;
  const me = g.players[mySeat].pos, op = g.players[opp].pos, name = g.players[opp].name;
  let text: string;
  if (g.current === mySeat) {
    // the last thing that happened was my own move, not the turn coming to me: I am still behind
    const last = [...g.events].reverse().find((e) => e.k === 'turn' || e.k === 'buy' || e.k === 'advance');
    const again = !!last && last.k !== 'turn' && 'seat' in last && last.seat === mySeat;
    text = again ? `${t('turn.again')} · ${t('turn.mine', { me, opp: op, name })}` : t('turn.mine', { me, opp: op, name });
  } else text = t('turn.theirs', { me, opp: op, name });
  return <div className={'turnline' + (g.current === mySeat ? ' mine' : '')} role="status">{text}</div>;
}
