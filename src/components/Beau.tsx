import { useId } from "react";

// Beau the Firefly: the app's mascot. Pure inline SVG, no image assets.
// useId gives each instance its own gradient/filter ids so several Beaus on
// one page don't reference each other's defs. React ids contain colons, which
// are awkward inside url(#...), so they are stripped.
export default function Beau({ size = 96, className = "" }: { size?: number; className?: string }) {
  const uid = useId().replace(/:/g, "");
  const glowId = `beau-glow-${uid}`;
  const blurId = `beau-blur-${uid}`;

  return (
    <svg
      role="img"
      aria-label="Beau the firefly"
      width={size}
      height={size}
      viewBox="0 0 120 120"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#d4ff3a" stopOpacity="1" />
          <stop offset="45%" stopColor="#d4ff3a" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#d4ff3a" stopOpacity="0" />
        </radialGradient>
        <filter id={blurId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      {/* Breathing glow behind the abdomen */}
      <g>
        <circle cx="60" cy="92" r="26" fill={`url(#${glowId})`}>
          <animate attributeName="opacity" values="0.45;1;0.45" dur="2.5s" repeatCount="indefinite" />
        </circle>
      </g>

      {/* Antennae */}
      <path d="M52 34 Q44 18 36 14" fill="none" stroke="#a7f3d0" strokeWidth="2" strokeLinecap="round" />
      <path d="M68 34 Q76 18 84 14" fill="none" stroke="#a7f3d0" strokeWidth="2" strokeLinecap="round" />
      <circle cx="36" cy="14" r="3" fill="#d4ff3a" />
      <circle cx="84" cy="14" r="3" fill="#d4ff3a" />

      {/* Translucent wings */}
      <ellipse cx="42" cy="52" rx="18" ry="11" transform="rotate(-25 42 52)" fill="#22d3ee" fillOpacity="0.25" stroke="#22d3ee" strokeOpacity="0.6" strokeWidth="1" />
      <ellipse cx="78" cy="52" rx="18" ry="11" transform="rotate(25 78 52)" fill="#22d3ee" fillOpacity="0.25" stroke="#22d3ee" strokeOpacity="0.6" strokeWidth="1" />

      {/* Glowing tail/abdomen (blurred halo under a crisp core) */}
      <ellipse cx="60" cy="90" rx="14" ry="16" fill="#d4ff3a" filter={`url(#${blurId})`} opacity="0.8" />
      <ellipse cx="60" cy="90" rx="11" ry="14" fill="#d4ff3a" />

      {/* Rounded head and thorax */}
      <circle cx="60" cy="42" r="12" fill="#0d1018" stroke="#d4ff3a" strokeWidth="2" />
      <rect x="48" y="50" width="24" height="22" rx="11" fill="#0d1018" stroke="#d4ff3a" strokeWidth="2" />

      {/* Eyes and smile */}
      <circle cx="55" cy="41" r="2.5" fill="#e2e8f0" />
      <circle cx="65" cy="41" r="2.5" fill="#e2e8f0" />
      <path d="M55 47 Q60 51 65 47" fill="none" stroke="#d4ff3a" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
