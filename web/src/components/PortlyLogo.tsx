export function PortlyLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="pl-arch" x1="14" y1="8" x2="50" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366f1"/>
          <stop offset="1" stopColor="#a78bfa"/>
        </linearGradient>
      </defs>
      <path d="M16 54V24C16 15.163 23.163 8 32 8C40.837 8 48 15.163 48 24V54" stroke="url(#pl-arch)" strokeWidth="5" strokeLinecap="round"/>
      <line x1="12" y1="54" x2="52" y2="54" stroke="url(#pl-arch)" strokeWidth="5" strokeLinecap="round"/>
      <circle cx="32" cy="26" r="3" fill="#38bdf8"/>
      <circle cx="32" cy="36" r="2.5" fill="#818cf8" opacity="0.8"/>
      <circle cx="32" cy="44" r="2" fill="#a78bfa" opacity="0.6"/>
      <circle cx="8" cy="26" r="2.5" fill="#38bdf8" opacity="0.7"/>
      <circle cx="8" cy="36" r="2.5" fill="#34d399" opacity="0.7"/>
      <circle cx="56" cy="26" r="2.5" fill="#fbbf24" opacity="0.7"/>
      <circle cx="56" cy="36" r="2.5" fill="#f87171" opacity="0.7"/>
      <line x1="10.5" y1="26" x2="16" y2="26" stroke="#38bdf8" strokeWidth="1.5" opacity="0.4" strokeLinecap="round"/>
      <line x1="10.5" y1="36" x2="16" y2="36" stroke="#34d399" strokeWidth="1.5" opacity="0.4" strokeLinecap="round"/>
      <line x1="48" y1="26" x2="53.5" y2="26" stroke="#fbbf24" strokeWidth="1.5" opacity="0.4" strokeLinecap="round"/>
      <line x1="48" y1="36" x2="53.5" y2="36" stroke="#f87171" strokeWidth="1.5" opacity="0.4" strokeLinecap="round"/>
    </svg>
  );
}
