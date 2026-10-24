/** Official Grid Rush artwork (public/brand). Paths honour Vite's base so the hosted web zip works in any folder. */
const asset = (p: string) => `${import.meta.env.BASE_URL}${p}`;
export function LogoMark({ size = 48 }: { size?: number }) {
  return <img src={asset('brand/logo-icon.png')} width={size} height={size} alt="" draggable={false} />;
}
export function Logo({ size = 44 }: { size?: number; stacked?: boolean }) {
  return <img className="logo-img" src={asset('brand/logo-wordmark.png')} alt="Grid Rush" style={{ width: size * 5, maxWidth: '78vw' }} draggable={false} />;
}
