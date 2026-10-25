import { useEffect, useState } from 'react';
import { screenArtUrl } from '../art';
import { useStore } from '../store';

const logo = `${import.meta.env.BASE_URL}brand/studio-logo.png`;
/** fade in, hold, fade out (ms) */
const TIMING = { in: 700, hold: 1300, out: 700 };
const GAME_HOLD = 1500;

/** Splash at launch: the Jolly Panda Studio logo fades in and out, then (in Persian) the painted «نقش‌نبرد» title art,
 *  then the loading screen starts. A tap skips it; with reduce motion it is a short static frame. */
export default function SplashScreen() {
  const reduce = useStore((s) => s.settings.reduceMotion);
  const fa = useStore((s) => s.settings.lang === 'fa');
  const [phase, setPhase] = useState<'in' | 'out' | 'game'>('in');
  const next = () => useStore.setState({ screen: 'loading' });
  useEffect(() => {
    const hold = reduce ? 600 : TIMING.in + TIMING.hold;
    const out = hold + (reduce ? 0 : TIMING.out);
    const t1 = setTimeout(() => setPhase('out'), hold);
    const t2 = setTimeout(() => (fa ? setPhase('game') : next()), out);
    const t3 = fa ? setTimeout(next, out + (reduce ? 600 : GAME_HOLD)) : undefined;
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [reduce, fa]);
  if (phase === 'game') {
    return (
      <main className="splash-art" onClick={next} aria-label="نقش‌نبرد">
        <img src={screenArtUrl('splash-fa')} alt="نقش‌نبرد" draggable={false} />
      </main>
    );
  }
  return (
    <main className={'splash ' + phase} onClick={next} aria-label="Jolly Panda Studio">
      <img src={logo} alt="Jolly Panda Studio" draggable={false} />
    </main>
  );
}
