import { useEffect, useState } from 'react';
import { screenArtUrl } from '../art';
import { Logo } from '../components/Logo';
import { useStore } from '../store';

const logo = `${import.meta.env.BASE_URL}brand/studio-logo.png`;
/** fade in, hold, fade out (ms) */
const TIMING = { in: 700, hold: 1300, out: 700 };
const GAME_HOLD = 1900;

/** Splash at launch: the Jolly Panda Studio logo fades in and out, then the game's title over the painted tile
 *  medallion (the logo follows the language), then the loading screen starts. A tap skips it. */
export default function SplashScreen() {
  const reduce = useStore((s) => s.settings.reduceMotion);
  const [phase, setPhase] = useState<'in' | 'out' | 'game'>('in');
  const next = () => useStore.setState({ screen: 'loading' });
  useEffect(() => {
    const hold = reduce ? 600 : TIMING.in + TIMING.hold;
    const out = hold + (reduce ? 0 : TIMING.out);
    const t1 = setTimeout(() => setPhase('out'), hold);
    const t2 = setTimeout(() => setPhase('game'), out);
    const t3 = setTimeout(next, out + (reduce ? 600 : GAME_HOLD));
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [reduce]);
  if (phase === 'game') {
    return (
      <main className="splash-art" onClick={next}>
        <img src={screenArtUrl('splash-bg')} alt="" draggable={false} />
        <div className="sp-logo"><Logo size={64} stacked /></div>
      </main>
    );
  }
  return (
    <main className={'splash ' + phase} onClick={next} aria-label="Jolly Panda Studio">
      <img src={logo} alt="Jolly Panda Studio" draggable={false} />
    </main>
  );
}
