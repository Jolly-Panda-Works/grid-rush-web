import { BOT_TIER_NAMES, REWARD_POSITIONS, TRACK_LENGTH, TREASURE_POSITIONS, canPlaceAny, engravedTotal, transformCells } from '../../../shared/src';
import { send } from '../net';
import { resetSel, setSel, useStore } from '../store';
import { CoinIcon, TileShape, TimeIcon } from './TileShape';
import { sfx } from '../audio';

void BOT_TIER_NAMES; void REWARD_POSITIONS;

export function OfferPanel() {
  const g = useStore((s) => s.game)!;
  const mySeat = useStore((s) => s.mySeat);
  const sel = useStore((s) => s.sel);
  const me = g.players[mySeat], opp = g.players[1 - mySeat];
  const myTurn = g.current === mySeat && g.phase === 'playing';
  const placing = g.current === mySeat && g.phase === 'placing_reward';

  if (placing) {
    return (
      <footer className="panel"><div className="banner accentb">Place your 1x1 reward tile on your board ({g.pendingRewards} left). Click an empty cell.</div></footer>
    );
  }
  if (!myTurn) {
    return (
      <footer className="panel"><div className="banner waiting">
        {g.phase === 'finished' ? 'Game over…' : `${opp.name}${opp.isBot ? ' (bot)' : ''} is playing`}<span className="dots" />
      </div></footer>
    );
  }
  const advSteps = Math.min(TRACK_LENGTH - me.pos, opp.pos + 1);
  const advEnds = me.pos + advSteps >= TRACK_LENGTH;
  const selTile = sel.offer !== null ? g.offer[sel.offer] : null;
  let hint = '';
  if (selTile) {
    const np = Math.min(TRACK_LENGTH, me.pos + selTile.timeCost);
    const tre = TREASURE_POSITIONS.filter((t) => t > me.pos && t <= np).length;
    const gain = tre * (engravedTotal(me) + selTile.engraved);
    hint = `${np > opp.pos ? 'Passes opponent: turn ends' : 'You keep the turn'}${tre ? ` · ${tre} treasure +${gain}` : ''}${np >= TRACK_LENGTH ? ' · ENDS THE GAME' : ''}`;
  }
  const select = (i: number) => { sfx.turn(); setSel({ offer: sel.offer === i ? null : i, rot: 0, flip: false, hover: null }); };

  return (
    <footer className="panel">
      <div className="offers">
        {g.offer.map((t, i) => {
          const afford = me.coins >= t.coinCost;
          const fits = canPlaceAny(me.board, t.cells);
          const disabled = !afford || !fits;
          const shown = sel.offer === i ? transformCells(t.cells, sel.rot, sel.flip) : t.cells;
          return (
            <button key={t.uid} className={'card ' + (sel.offer === i ? 'sel ' : '') + (disabled ? 'dis' : '')} disabled={disabled} onClick={() => select(i)}
              title={!afford ? 'Not enough coins' : !fits ? 'No room on your board' : `Select (${i + 1})`}>
              <kbd>{i + 1}</kbd>
              <div className="shape"><TileShape cells={shown} shape={t.shape} engraved={t.engraved} cell={16} /></div>
              <div className="costs num">
                <span className={!afford ? 'bad' : ''}><CoinIcon /> {t.coinCost}</span>
                <span><TimeIcon /> {t.timeCost}</span>
                {t.engraved > 0 && <span className="eng" title="Engraved coins (paid out at treasures)">⛁ {t.engraved}</span>}
              </div>
              {disabled && <div className="why">{!afford ? 'Need coins' : 'No room'}</div>}
            </button>
          );
        })}
      </div>
      <div className="actions">
        <div className="tools">
          <button className="btn ghost" disabled={!selTile} onClick={() => setSel({ rot: (sel.rot + 1) % 4 })}>Rotate <kbd>R</kbd></button>
          <button className="btn ghost" disabled={!selTile} onClick={() => setSel({ flip: !sel.flip })}>Flip <kbd>F</kbd></button>
          <button className="btn ghost" disabled={!selTile} onClick={resetSel}>Cancel <kbd>Esc</kbd></button>
        </div>
        <div className="hint">{selTile ? hint : 'Pick a tile, then place it on your board, or advance.'}</div>
        <button className={'btn primary adv ' + (advEnds ? 'danger' : '')} onClick={() => { sfx.advance(); resetSel(); send.advance(); }}>
          Advance <kbd>A</kbd>
          <small>+{advSteps} cells · +{advSteps} coins{advEnds ? ' · ends game' : ''}</small>
        </button>
      </div>
    </footer>
  );
}
