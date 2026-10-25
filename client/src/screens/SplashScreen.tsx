import { useEffect, useState } from 'react';
import { useStore } from '../store';

const logo = `${import.meta.env.BASE_URL}brand/studio-logo.png`;
/** fade in, hold, fade out (ms) */
const TIMING = { in: 700, hold: 1300, out: 700 };

/** Studio splash shown once at launch: the Jolly Panda Studio logo fades in and out, then the loading screen starts.
 *  A tap skips it; with reduce motion it is a short static frame. */
export default function SplashScreen() {
  const reduce = useStore((s) => s.settings.reduceMotion);
  const [phase, setPhase] = useState<'in' | 'out'>('in');
  const next = () => useStore.setState({ screen: 'loading' });
  useEffect(() => {
    const hold = reduce ? 600 : TIMING.in + TIMING.hold;
    const t1 = setTimeout(() => setPhase('out'), hold);
    const t2 = setTimeout(next, hold + (reduce ? 0 : TIMING.out));
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [reduce]);
  return (
    <main className={'splash ' + phase} onClick={next} aria-label="Jolly Panda Studio">
      <img src={logo} alt="Jolly Panda Studio" draggable={false} />
    </main>
  );
}
