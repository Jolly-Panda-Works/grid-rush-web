export function LogoMark({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <rect x="3" y="3" width="19" height="19" rx="4" fill="#4285F4" />
      <rect x="26" y="3" width="19" height="19" rx="4" fill="#EA4335" />
      <rect x="3" y="26" width="19" height="19" rx="4" fill="#FBBC05" />
      <path d="M28 27l8 9-8 9z" fill="#34A853" />
      <path d="M37 27l8 9-8 9z" fill="#34A853" opacity="0.75" />
    </svg>
  );
}
export function Logo({ size = 44, stacked = false }: { size?: number; stacked?: boolean }) {
  return (
    <div className={'logo' + (stacked ? ' stacked' : '')}>
      <LogoMark size={size} />
      <span className="wordmark" style={{ fontSize: size * 0.8 }}>Grid Rush</span>
    </div>
  );
}
