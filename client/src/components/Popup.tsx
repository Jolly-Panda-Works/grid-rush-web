import { useEffect, useState } from 'react';
import { useStore } from '../store';

/** Centered notification: fades in, holds briefly, fades out. Messages are queued and shown one at a time. */
export function Popup() {
  const head = useStore((s) => s.popups[0]);
  const id = head?.id;
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (id === undefined) return;
    setLeaving(false);
    const n = useStore.getState().popups.length;
    const hold = n > 2 ? 650 : n > 1 ? 950 : 1400;
    const t1 = setTimeout(() => setLeaving(true), hold);
    const t2 = setTimeout(() => useStore.setState((s) => ({ popups: s.popups.filter((p) => p.id !== id) })), hold + 320);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [id]);
  if (!head) return null;
  return (
    <div className="popup-wrap" aria-live="assertive">
      <div key={head.id} className={'popup ' + head.tone + (leaving ? ' out' : '')} role="status">{head.text}</div>
    </div>
  );
}
