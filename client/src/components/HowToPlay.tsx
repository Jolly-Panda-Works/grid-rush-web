import { useStore } from '../store';
import { useT } from '../i18n';
import { BOARD_SIZE, EMPTY_CELL_PENALTY, SPECIAL_7X7_BONUS, STARTING_COINS, TRACK_LENGTH } from '../../../shared/src';

export default function HowToPlay() {
  const t = useT();
  const close = () => useStore.setState({ showHelp: false });
  const v = { n: BOARD_SIZE, b: SPECIAL_7X7_BONUS, l: TRACK_LENGTH, p: EMPTY_CELL_PENALTY, c: STARTING_COINS };
  return (
    <div className="overlay" onClick={close}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('help.title')}>
        <h2>{t('help.title')}</h2>
        <p className="muted">{t('help.sub', v)}</p>
        <ul className="rules">{Array.from({ length: 10 }, (_, i) => <li key={i}>{t('help.r' + (i + 1), v)}</li>)}</ul>
        <p className="muted small">{t('help.keys')}</p>
        <button className="btn primary" onClick={close}>{t('help.ok')}</button>
      </div>
    </div>
  );
}
