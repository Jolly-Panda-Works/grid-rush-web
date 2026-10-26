import { Seat, engravedTotal, rewardsOf, trackLen, treasuresOf } from '../../../shared/src';
import { useForecast } from '../forecast';
import { useT } from '../i18n';
import { useStore } from '../store';
import { Icon } from '../art';
import { iconUrl } from '../three/icons';

/** Cells before the finish at which the game warns that it is about to end. */
export const END_WARN = 8;

/** The whole time track as one slim line along the edge of the top bar: both markers, treasures, free 1x1 tiles, finish. No text. */
export function TrackLine() {
  const t = useT();
  const g = useStore((s) => s.game)!;
  const mySeat = useStore((s) => s.mySeat);
  const fc = useForecast();
  const me = g.players[mySeat];
  const len = trackLen(g);
  const ending = len - Math.max(g.players[0].pos, g.players[1].pos) <= END_WARN && g.phase !== 'finished';
  const pct = (i: number) => `${(i / len) * 100}%`;
  const order: Seat[] = [(1 - mySeat) as Seat, mySeat]; // my marker drawn on top
  return (
    <div className={'trackline' + (ending ? ' ending' : '')} title={t('bar.title')} aria-hidden="true">
      <div className="mline" />
      {treasuresOf(g).map((p) => <i key={'t' + p} className={'mt' + (p <= me.pos ? ' past' : '')} style={{ left: pct(p) }} />)}
      {rewardsOf(g).map((p, i) => !g.rewardTaken[i] && <i key={'r' + p} className="mr" style={{ left: pct(p) }} />)}
      <i className="mf" style={{ left: '100%' }} />
      {fc && <i className={'mp ghost p' + fc.seat} style={{ left: pct(fc.to) }} />}
      {order.map((s) => <i key={s} className={'mp p' + s + (g.current === s ? ' cur' : '')} style={{ left: pct(g.players[s].pos) }} />)}
    </div>
  );
}

/** My next goal on the track as one small gem: cells to the next treasure (and what it pays), or, near the end,
 *  cells left before the game ends. */
export function NextGem() {
  const t = useT();
  const g = useStore((s) => s.game)!;
  const me = g.players[useStore((s) => s.mySeat)];
  const toEnd = trackLen(g) - Math.max(g.players[0].pos, g.players[1].pos);
  const empty = <span className="gem next num slot-empty" aria-hidden="true"><b>0</b></span>; // keeps its place in the layout
  if (g.phase === 'finished') return empty;
  if (toEnd <= END_WARN) return <span key={toEnd} className="gem warn num" title={t('bar.end', { d: toEnd })}><Icon id="finish" size={18} /><b>{toEnd}</b></span>;
  const nextT = treasuresOf(g).find((p) => p > me.pos);
  if (nextT === undefined) return empty;
  const pays = engravedTotal(me);
  return (
    <span key={nextT - me.pos} className="gem next num" title={pays > 0 ? t('bar.next', { d: nextT - me.pos, c: pays }) : t('bar.nextZero', { d: nextT - me.pos })}>
      <img src={iconUrl('chest')} alt="" /><b>{nextT - me.pos}</b>{pays > 0 && <small>+{pays}</small>}
    </span>
  );
}
