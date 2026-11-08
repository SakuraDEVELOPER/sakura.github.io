import type { SVGProps } from "react";

export function SakuraIcon({ className = "h-5 w-5", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <defs>
        <linearGradient id="sakuraCompGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffccd5" />
          <stop offset="50%" stopColor="#ff9ebb" />
          <stop offset="100%" stopColor="#ff7096" />
        </linearGradient>
        <radialGradient id="sakuraCompCenterGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="40%" stopColor="#ffe4ea" />
          <stop offset="100%" stopColor="#ff527b" />
        </radialGradient>
      </defs>

      {/* 5 Petals */}
      <path
        d="M 16 16 C 13.5 12.2, 11 7.2, 13.2 4.2 C 14.4 2.8, 15.3 4.2, 16 5.5 C 16.7 4.2, 17.6 2.8, 18.8 4.2 C 21 7.2, 18.5 12.2, 16 16 Z"
        fill="url(#sakuraCompGrad)"
      />
      <path
        d="M 16 16 C 13.5 12.2, 11 7.2, 13.2 4.2 C 14.4 2.8, 15.3 4.2, 16 5.5 C 16.7 4.2, 17.6 2.8, 18.8 4.2 C 21 7.2, 18.5 12.2, 16 16 Z"
        fill="url(#sakuraCompGrad)"
        transform="rotate(72 16 16)"
      />
      <path
        d="M 16 16 C 13.5 12.2, 11 7.2, 13.2 4.2 C 14.4 2.8, 15.3 4.2, 16 5.5 C 16.7 4.2, 17.6 2.8, 18.8 4.2 C 21 7.2, 18.5 12.2, 16 16 Z"
        fill="url(#sakuraCompGrad)"
        transform="rotate(144 16 16)"
      />
      <path
        d="M 16 16 C 13.5 12.2, 11 7.2, 13.2 4.2 C 14.4 2.8, 15.3 4.2, 16 5.5 C 16.7 4.2, 17.6 2.8, 18.8 4.2 C 21 7.2, 18.5 12.2, 16 16 Z"
        fill="url(#sakuraCompGrad)"
        transform="rotate(216 16 16)"
      />
      <path
        d="M 16 16 C 13.5 12.2, 11 7.2, 13.2 4.2 C 14.4 2.8, 15.3 4.2, 16 5.5 C 16.7 4.2, 17.6 2.8, 18.8 4.2 C 21 7.2, 18.5 12.2, 16 16 Z"
        fill="url(#sakuraCompGrad)"
        transform="rotate(288 16 16)"
      />

      {/* Center Pistil & Stamens */}
      <circle cx="16" cy="16" r="3.2" fill="url(#sakuraCompCenterGrad)" />

      <line x1="16" y1="16" x2="16" y2="10.5" stroke="#ff3366" strokeWidth="0.8" strokeLinecap="round" />
      <circle cx="16" cy="10.2" r="0.9" fill="#ffe066" />

      <line x1="16" y1="16" x2="21.2" y2="14.3" stroke="#ff3366" strokeWidth="0.8" strokeLinecap="round" />
      <circle cx="21.5" cy="14.4" r="0.9" fill="#ffe066" />

      <line x1="16" y1="16" x2="19.2" y2="20.5" stroke="#ff3366" strokeWidth="0.8" strokeLinecap="round" />
      <circle cx="19.4" cy="20.8" r="0.9" fill="#ffe066" />

      <line x1="16" y1="16" x2="12.8" y2="20.5" stroke="#ff3366" strokeWidth="0.8" strokeLinecap="round" />
      <circle cx="12.6" cy="20.8" r="0.9" fill="#ffe066" />

      <line x1="16" y1="16" x2="10.8" y2="14.3" stroke="#ff3366" strokeWidth="0.8" strokeLinecap="round" />
      <circle cx="10.5" cy="14.4" r="0.9" fill="#ffe066" />

      {/* Center core highlight */}
      <circle cx="16" cy="16" r="1.3" fill="#ffffff" />
    </svg>
  );
}

export default SakuraIcon;
