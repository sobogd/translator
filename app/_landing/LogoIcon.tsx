export function LogoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id="iqt-logo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="hsl(9, 100%, 58%)" />
          <stop offset="100%" stopColor="hsl(35, 95%, 55%)" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="96" fill="url(#iqt-logo-bg)" />
      <text
        x="256"
        y="256"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
        fontWeight="800"
        fontSize="280"
        letterSpacing="-12"
        fill="#ffffff"
      >
        IQ
      </text>
    </svg>
  );
}
