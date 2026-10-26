import { wordmarkUrl } from '../art';
import { useStore } from '../store';

/** Official Grid Rush artwork (public/brand, public/art). Paths honour Vite's base so the hosted web zip works in any folder. */
const asset = (p: string) => `${import.meta.env.BASE_URL}${p}`;
export function LogoMark({ size = 48 }: { size?: number }) {
  return <img src={asset('brand/logo-icon.png')} width={size} height={size} alt="" draggable={false} />;
}
/** The tilework logotype, in Persian or English with the UI language. */
export function Logo({ size = 44 }: { size?: number; stacked?: boolean }) {
  const lang = useStore((s) => s.settings.lang);
  return <img className="logo-img" src={wordmarkUrl(lang)} alt={lang === 'fa' ? 'نقش‌آرا' : 'Grid Rush'} style={{ width: size * 5.4, maxWidth: '86vw' }} draggable={false} />;
}
