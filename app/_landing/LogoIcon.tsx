export function LogoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className={className}>
      <rect width="512" height="512" rx="96" fill="#d9534f" />
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
