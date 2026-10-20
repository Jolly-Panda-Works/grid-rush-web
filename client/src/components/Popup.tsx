import { useEffect } from 'react';
import { useStore } from '../store';

/** Centered notification popup. Messages are shown one after another (queue), never in a corner. */
export function Popup() {
  const head = useStore((s) => s.popups[0]);
  const id = head?.id;
  useEffect(() => {
    if (id === undefined) return;
    const n = useStore.getState().popups.length;
    const ms = n > 3 ? 850 : n > 1 ? 1250 : 1800;
    const t = setTimeout(() => useStore.setState((s) => ({ popups: s.popups.filter((p) => p.id !== id) })), ms);
    return () => clearTimeout(t);
  }, [id]);
  if (!head) return null;
  return (
    <div className="popup-wrap" aria-live="assertive">
      <div key={head.id} className={'popup ' + head.tone} role="status">{head.text}</div>
    </div>
  );
}
