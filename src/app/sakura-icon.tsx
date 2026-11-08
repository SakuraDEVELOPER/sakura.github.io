import type { SVGProps } from "react";

export function SakuraIcon({ className = "h-5 w-5", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      role="img"
      aria-label="Sakura"
      viewBox="0 0 352 352"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <g
        fill="#FFB7D5"
        fillOpacity="0.32"
        stroke="#FFFFFF"
        strokeWidth="20"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M 176.0 176.0 C 114.40 110.00 129.07 44.00 129.07 44.00 Q 157.23 41.36 176.00 67.47 Q 194.77 41.36 222.93 44.00 C 222.93 44.00 237.60 110.00 176.0 176.0 Z M 176.0 176.0 C 219.73 97.02 287.04 90.57 287.04 90.57 Q 298.25 116.54 279.22 142.46 Q 309.85 152.25 316.04 179.85 C 316.04 179.85 257.81 214.19 176.0 176.0 Z M 176.0 176.0 C 264.63 193.19 291.56 255.20 291.56 255.20 Q 270.33 273.89 239.79 263.81 Q 239.95 295.96 215.62 310.38 C 215.62 310.38 164.96 265.60 176.0 176.0 Z M 176.0 176.0 C 187.04 265.60 136.38 310.38 136.38 310.38 Q 112.05 295.96 112.21 263.81 Q 81.67 273.89 60.44 255.20 C 60.44 255.20 87.37 193.19 176.0 176.0 Z M 176.0 176.0 C 94.19 214.19 35.96 179.85 35.96 179.85 Q 42.15 152.25 72.78 142.46 Q 53.75 116.54 64.96 90.57 C 64.96 90.57 132.27 97.02 176.0 176.0 Z" />
        <circle cx="176.0" cy="176.0" r="26.4" fill="#FFFFFF" fillOpacity="0.88" stroke="none" />
      </g>
    </svg>
  );
}

export default SakuraIcon;
