import { REWARD_POSITIONS, Seat, TRACK_LENGTH, TREASURE_POSITIONS, engravedTotal } from '../../../shared/src';
import { useForecast } from '../forecast';
import { useT } from '../i18n';
import { useStore } from '../store';
import { iconUrl } from '../three/icons';
import { CoinIcon } from './TileShape';

/** Cells before the finish at which the bar turns into an end-of-game warning. */
const END_WARN = 8;

/** Whole time track at a glance (both markers, treasures, free 1x1 tiles, finish) + what is coming up next for me. */
export function TrackBar() {
  const t = useT();
  const g = useStore((s) => s.game)!;
  const mySeat = useStore((s) => s.mySeat);
  const fc = useForecast();
  const me = g.players[mySeat];
  const lead = Math.max(g.players[0].pos, g.players[1].pos);
  const toEnd = TRACK_LENGTH - lead;
  const ending = toEnd <= END_WARN && g.phase !== 'finished';
  const nextT = TREASURE_POSITIONS.find((p) => p > me.pos);
  const pct = (i: number) => `${(i / TRACK_LENGTH) * 100}%`;
  const order: Seat[] = [(1 - mySeat) as Seat, mySeat]; // my marker drawn on top

  return (
    <div className={'trackbar' + (ending ? ' ending' : '')} title={t('bar.title')}>
      <div className="mmap" aria-hidden="true">
        <div className="mline" />
        {TREASURE_POSITIONS.map((p) => <i key={'t' + p} className={'mt' + (p <= me.pos ? ' past' : '')} style={{ left: pct(p) }} />)}
        {REWARD_POSITIONS.map((p, i) => !g.rewardTaken[i] && <i key={'r' + p} className="mr" style={{ left: pct(p) }} />)}
        <i className="mf" style={{ left: '100%' }} />
        {fc && <i className={'mp ghost p' + mySeat} style={{ left: pct(fc.to) }} />}
        {order.map((s) => <i key={s} className={'mp p' + s + (g.current === s ? ' cur' : '')} style={{ left: pct(g.players[s].pos) }} />)}
      </div>
      <div className="bchip num">
        {ending
          ? <span className="bend">{t('bar.end', { d: toEnd })}</span>
          : nextT === undefined
            ? <span>{t('bar.none')}</span>
            : engravedTotal(me) > 0
              ? <span><img src={iconUrl('chest')} alt="" />{t('bar.next', { d: nextT - me.pos, c: engravedTotal(me) })}<CoinIcon size={12} /></span>
              : <span><img src={iconUrl('chest')} alt="" />{t('bar.nextZero', { d: nextT - me.pos })}</span>}
      </div>
    </div>
  );
}
