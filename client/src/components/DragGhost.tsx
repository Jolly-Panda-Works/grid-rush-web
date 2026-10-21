import { transformCells } from '../../../shared/src';
import { useStore } from '../store';
import { dragApi } from '../three/dragApi';
import { TileShape } from './TileShape';

/** The tile itself follows the pointer while dragging (semi-transparent over the board, where the placement preview is drawn). */
export function DragGhost() {
  const drag = useStore((s) => s.drag);
  const sel = useStore((s) => s.sel);
  const g = useStore((s) => s.game);
  if (!drag || !g || sel.offer === null) return null;
  const tile = g.offer[sel.offer];
  if (!tile) return null;
  const cell = Math.max(18, Math.min(64, Math.round(dragApi.cellPx?.() ?? 30)));
  return (
    <div className={'drag-ghost' + (sel.hover ? ' over' : '')} style={{ left: drag.x, top: drag.y }}>
      <TileShape cells={transformCells(tile.cells, sel.rot, sel.flip)} shape={tile.shape} engraved={tile.engraved} cell={cell} />
    </div>
  );
}
