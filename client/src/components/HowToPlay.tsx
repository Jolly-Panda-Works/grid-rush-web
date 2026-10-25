import { useStore } from '../store';
import { Icon, IconId } from '../art';
import { useT } from '../i18n';
import { Legend } from './Legend';
import { BOARD_SIZE, COIN_SCORE_DIVISOR, EMPTY_CELL_PENALTY, SPECIAL_7X7_BONUS, STARTING_COINS, TRACK_LENGTH } from '../../../shared/src';

/** One icon per rule, in rule order: buy, pay & move, advance, turns, treasure, 1x1, 7x7, end, score, start. */
const ICONS: IconId[] = ['buy-tile', 'hourglass', 'advance', 'turns', 'treasure', 'gift', 'ach-bonus7', 'finish', 'scales', 'coins'];

export default function HowToPlay() {
  const t = useT();
  const close = () => useStore.setState({ showHelp: false });
  const v = { n: BOARD_SIZE, b: SPECIAL_7X7_BONUS, l: TRACK_LENGTH, p: EMPTY_CELL_PENALTY, c: STARTING_COINS, d: COIN_SCORE_DIVISOR };
  return (
    <div className="overlay" onClick={close}>
      <div className="modal help" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('help.title')}>
        <h2>{t('help.title')}</h2>
        <button className="mclose" onClick={close} aria-label={t('help.ok')}>✕</button>
        <div className="mscroll">
        <p className="muted">{t('help.sub', v)}</p>
        <ul className="rules">{ICONS.map((ic, i) => <li key={i}><span className="ri" aria-hidden="true"><Icon id={ic} size={30} /></span><span>{t('help.r' + (i + 1), v)}</span></li>)}</ul>
        <Legend inline />
        <p className="muted small">{t('help.keys')}</p>
        </div>
        <button className="btn primary" onClick={close}>{t('help.ok')}</button>
      </div>
    </div>
  );
}
