import { useT } from '../i18n';
import { iconUrl, IconKind } from '../three/icons';

const ITEMS: { kind: IconKind; key: string }[] = [
  { kind: 'chest', key: 'legend.treasure' },
  { kind: 'reward', key: 'legend.reward' },
  { kind: 'flag', key: 'legend.finish' },
  { kind: 'coin', key: 'legend.coin' },
];

/** Explains the symbols on the time track and on the tiles. */
export function Legend({ inline = false }: { inline?: boolean }) {
  const t = useT();
  return (
    <div className={inline ? 'legend-inline' : 'legend'} aria-label={t('legend.title')}>
      {ITEMS.map((it) => (
        <span key={it.kind} className="litem"><img src={iconUrl(it.kind)} width={22} height={22} alt="" />{t(it.key)}</span>
      ))}
    </div>
  );
}
