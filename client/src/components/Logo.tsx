/** Official Grid Rush artwork (public/brand). */
export function LogoMark({ size = 48 }: { size?: number }) {
  return <img src="/brand/logo-icon.png" width={size} height={size} alt="" draggable={false} />;
}
export function Logo({ size = 44 }: { size?: number; stacked?: boolean }) {
  return <img className="logo-img" src="/brand/logo-wordmark.png" alt="Grid Rush" style={{ width: size * 5, maxWidth: '78vw' }} draggable={false} />;
}
