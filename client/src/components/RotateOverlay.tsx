import { useEffect, useState } from 'react';
import { isMobile } from '../device';
import { useT } from '../i18n';

const isLandscape = () => window.innerWidth > window.innerHeight;

/** On phones Grid Rush is portrait-only: in landscape the player is asked to rotate the device back. */
export function RotateOverlay() {
  const t = useT();
  const [wrong, setWrong] = useState(isMobile() && isLandscape());
  useEffect(() => {
    const on = () => setWrong(isMobile() && isLandscape());
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', on);
    // Best effort lock (works in installed PWAs / fullscreen on Android; ignored elsewhere)
    const lock = () => { try { (screen.orientation as unknown as { lock?: (o: string) => Promise<void> }).lock?.('portrait')?.catch(() => {}); } catch { /* ignore */ } };
    if (isMobile()) window.addEventListener('pointerdown', lock, { once: true });
    return () => { window.removeEventListener('resize', on); window.removeEventListener('orientationchange', on); };
  }, []);
  if (!wrong) return null;
  return (
    <div className="rotate-overlay" role="alert">
      <svg width="96" height="96" viewBox="0 0 64 64" className="rot-phone" aria-hidden="true">
        <rect x="20" y="6" width="24" height="44" rx="5" fill="none" stroke="#FFB400" strokeWidth="3.5" />
        <circle cx="32" cy="44" r="2" fill="#FFB400" />
        <path d="M50 24a18 18 0 0 1 0 22" fill="none" stroke="#17A8F0" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M45 44l5 3 3-5" fill="none" stroke="#17A8F0" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <h2>{t('rotate.title')}</h2>
      <p>{t('rotate.text')}</p>
    </div>
  );
}
