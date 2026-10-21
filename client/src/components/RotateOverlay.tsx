import { useEffect, useState } from 'react';
import { useT } from '../i18n';

const isPortrait = () => window.innerHeight > window.innerWidth;

/** Grid Rush is landscape-only: in portrait the player is asked to rotate the device. */
export function RotateOverlay() {
  const t = useT();
  const [portrait, setPortrait] = useState(isPortrait());
  useEffect(() => {
    const on = () => setPortrait(isPortrait());
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', on);
    // Best effort lock (works in installed PWAs / fullscreen on Android; ignored elsewhere)
    const lock = () => { try { (screen.orientation as unknown as { lock?: (o: string) => Promise<void> }).lock?.('landscape')?.catch(() => {}); } catch { /* ignore */ } };
    if (matchMedia('(pointer: coarse)').matches) window.addEventListener('pointerdown', lock, { once: true });
    return () => { window.removeEventListener('resize', on); window.removeEventListener('orientationchange', on); };
  }, []);
  if (!portrait) return null;
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
