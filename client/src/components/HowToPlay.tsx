import { useStore } from '../store';
import { BOARD_SIZE, EMPTY_CELL_PENALTY, SPECIAL_7X7_BONUS, STARTING_COINS, TRACK_LENGTH } from '../../../shared/src';

export default function HowToPlay() {
  const close = () => useStore.setState({ showHelp: false });
  return (
    <div className="overlay" onClick={close}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="How to play">
        <h2>How to play</h2>
        <p className="muted">Fill your {BOARD_SIZE}x{BOARD_SIZE} board while racing your opponent on one shared time track.</p>
        <ul className="rules">
          <li><b>Each action is one of two:</b> Buy a tile from the 3 on offer, or Advance.</li>
          <li><b>Buy:</b> pay its coin cost, place it (rotate and flip are free), then move forward by its time cost.</li>
          <li><b>Advance:</b> move forward by (opponent position + 1) cells and gain 1 coin per cell. Your catch-up tool.</li>
          <li><b>Turns:</b> you keep acting until you pass your opponent. Landing on the same cell does not end your turn.</li>
          <li><b>Treasure cells:</b> passing one pays the sum of the coins engraved on all your tiles.</li>
          <li><b>1x1 reward cells:</b> the first player to reach one takes the tile and must place it on their board.</li>
          <li><b>7x7 bonus:</b> the first player to fill any 7x7 area gets +{SPECIAL_7X7_BONUS} (once per game).</li>
          <li><b>Game ends</b> when someone reaches cell {TRACK_LENGTH}, or a board is completely full.</li>
          <li><b>Score:</b> coins + bonus - {EMPTY_CELL_PENALTY} per empty cell. A tie goes to the player who ended the game.</li>
          <li>You start with {STARTING_COINS} coins. Ending the game does not guarantee a win: check the score first.</li>
        </ul>
        <p className="muted small">Shortcuts: 1-3 select tile, R rotate, F flip, A advance, Esc cancel. On touch: tap to preview, tap again to place.</p>
        <button className="btn primary" onClick={close}>Got it</button>
      </div>
    </div>
  );
}
