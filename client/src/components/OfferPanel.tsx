import { BOT_TIER_NAMES, REWARD_POSITIONS, TRACK_LENGTH, TREASURE_POSITIONS, canPlaceAny, engravedTotal, transformCells } from '../../../shared/src';
import { useT } from '../i18n';
import { send } from '../net';
import { resetSel, setSel, useStore } from '../store';
import { CoinIcon, TileShape, TimeIcon } from './TileShape';
import { sfx } from '../audio';

void BOT_TIER_NAMES; void REWARD_POSITIONS;

export function OfferPanel() {
  const t = useT();
  const g = useStore((s) => s.game)!;
  const mySeat = useStore((s) => s.mySeat);
  const sel = useStore((s) => s.sel);
  const me = g.players[mySeat], opp = g.players[1 - mySeat];
  const myTurn = g.current === mySeat && g.phase === 'playing';
  const placing = g.current === mySeat && g.phase === 'placing_reward';

  if (placing) {
    return (
      <footer className="panel"><div className="banner accentb">{t('offer.placeReward', { n: g.pendingRewards })}</div></footer>
    );
  }
  if (!myTurn) {
    return (
      <footer className="panel"><div className="banner waiting">
        {g.phase === 'finished' ? t('offer.over') : t('offer.playing', { name: opp.name, bot: opp.isBot ? t('offer.botSuffix') : '' })}<span className="dots" />
      </div></footer>
    );
  }
  // RULE v0.4: Advance jumps to exactly (opponent position + 1)
  const advSteps = Math.min(TRACK_LENGTH - me.pos, Math.max(1, opp.pos + 1 - me.pos));
  const advEnds = me.pos + advSteps >= TRACK_LENGTH;
  const selTile = sel.offer !== null ? g.offer[sel.offer] : null;
  let hint = '';
  if (selTile) {
    const np = Math.min(TRACK_LENGTH, me.pos + selTile.timeCost);
    const tre = TREASURE_POSITIONS.filter((t) => t > me.pos && t <= np).length;
    const gain = tre * (engravedTotal(me) + selTile.engraved);
    hint = `${np > opp.pos ? t('offer.passes') : t('offer.keeps')}${tre ? ` · ${t('offer.tre', { n: tre, c: gain })}` : ''}${np >= TRACK_LENGTH ? ` · ${t('offer.ends')}` : ''}`;
  }
  const select = (i: number) => { sfx.turn(); setSel({ offer: sel.offer === i ? null : i, rot: 0, flip: false, hover: null }); };

  return (
    <footer className="panel">
      <div className="offers">
        {g.offer.map((tile, i) => {
          const afford = me.coins >= tile.coinCost;
          const fits = canPlaceAny(me.board, tile.cells);
          const disabled = !afford || !fits;
          const shown = sel.offer === i ? transformCells(tile.cells, sel.rot, sel.flip) : tile.cells;
          return (
            <button key={tile.uid} className={'card ' + (sel.offer === i ? 'sel ' : '') + (disabled ? 'dis' : '')} disabled={disabled} onClick={() => select(i)}
              title={!afford ? t('offer.noCoins') : !fits ? t('offer.noRoom') : t('offer.select', { n: i + 1 })}>
              <kbd>{i + 1}</kbd>
              <div className="shape"><TileShape cells={shown} shape={tile.shape} engraved={tile.engraved} cell={16} /></div>
              <div className="costs num">
                <span className={!afford ? 'bad' : ''}><CoinIcon /> {tile.coinCost}</span>
                <span><TimeIcon /> {tile.timeCost}</span>
                {tile.engraved > 0 && <span className="eng" title={t('offer.engraved')}>⛁ {tile.engraved}</span>}
              </div>
              {disabled && <div className="why">{!afford ? t('offer.needCoins') : t('offer.room')}</div>}
            </button>
          );
        })}
      </div>
      <div className="actions">
        <div className="tools">
          <button className="btn ghost" disabled={!selTile} onClick={() => setSel({ rot: (sel.rot + 1) % 4 })}>{t('offer.rotate')} <kbd>R</kbd></button>
          <button className="btn ghost" disabled={!selTile} onClick={() => setSel({ flip: !sel.flip })}>{t('offer.flip')} <kbd>F</kbd></button>
          <button className="btn ghost" disabled={!selTile} onClick={resetSel}>{t('offer.cancel')} <kbd>Esc</kbd></button>
        </div>
        <div className="hint">{selTile ? hint : t('offer.hint')}</div>
        <button className={'btn primary adv ' + (advEnds ? 'danger' : '')} onClick={() => { sfx.advance(); resetSel(); send.advance(); }}>
          {t('offer.advance')} <kbd>A</kbd>
          <small>{t('offer.advInfo', { n: advSteps })}{advEnds ? t('offer.advEnds') : ''}</small>
        </button>
      </div>
    </footer>
  );
}
