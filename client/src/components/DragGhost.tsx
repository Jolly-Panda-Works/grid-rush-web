import { transformCells } from '../../../shared/src';
import { useStore } from '../store';
import { TileShape } from './TileShape';

/** Tile that follows the pointer while dragging; hidden once the board shows the placement preview. */
export function DragGhost() {
  const drag = useStore((s) => s.drag);
  const sel = useStore((s) => s.sel);
  const g = useStore((s) => s.game);
  if (!drag || !g || sel.offer === null || sel.hover) return null;
  const tile = g.offer[sel.offer];
  if (!tile) return null;
  return (
    <div className="ghost" style={{ left: drag.x, top: drag.y }}>
      <TileShape cells={transformCells(tile.cells, sel.rot, sel.flip)} shape={tile.shape} engraved={tile.engraved} cell={30} />
    </div>
  );
}
