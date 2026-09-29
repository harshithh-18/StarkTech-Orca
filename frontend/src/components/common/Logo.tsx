/**
 * The ORCA mark — Maritime intelligence emblem.
 *
 * Designed with oceanic depth, wave harmonics, and bioluminescent gradients.
 */

import { useState } from "react";

export const LOGO_SRC = "/orca-logo.png";

interface Props {
  /** Rendered tile size in px. */
  size?: number;
  /** Rounding of the tile. Matches surrounding controls. */
  rounded?: string;
  className?: string;
}

export default function Logo({ size = 32, rounded = "rounded-full", className = "" }: Props) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className={`relative inline-flex shrink-0 items-center justify-center ${rounded} ${className}`}
    >
      {!imgFailed ? (
        <img
          src={LOGO_SRC}
          alt="ORCA"
          width={size}
          height={size}
          onError={() => setImgFailed(true)}
          className="h-full w-full object-contain drop-shadow-sm"
        />
      ) : (
        // High-end nautical Orca emblem over ocean swell
        <svg
          viewBox="0 0 32 32"
          width={size * 0.85}
          height={size * 0.85}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="orcaGrad" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
              <stop stopColor="#38bdf8" />
              <stop offset="0.5" stopColor="#2dd4bf" />
              <stop offset="1" stopColor="#059669" />
            </linearGradient>
            <linearGradient id="waveGrad" x1="2" y1="24" x2="30" y2="24" gradientUnits="userSpaceOnUse">
              <stop stopColor="#0284c7" stopOpacity="0.4" />
              <stop offset="0.5" stopColor="#14b8a6" stopOpacity="0.8" />
              <stop offset="1" stopColor="#38bdf8" stopOpacity="0.4" />
            </linearGradient>
          </defs>

          {/* Ocean swell backdrop */}
          <path
            d="M3 24C6.5 22.5 10 25.5 13.5 24C17 22.5 20.5 25.5 24 24C26.5 22.8 28.5 24.5 30 24"
            stroke="url(#waveGrad)"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          <path
            d="M2 28C6 26.5 9.5 29.5 13.5 28C17.5 26.5 21 29.5 25 28C27.5 27 29.5 28.5 31 28"
            stroke="url(#waveGrad)"
            strokeWidth="1.2"
            strokeLinecap="round"
            opacity="0.6"
          />

          {/* Whale body silhouette with breaching arc */}
          <path
            d="M5 16.5C8 11.5 14 9.5 20.5 11C23.5 11.8 26.5 14 27.5 16C25.5 17.5 22 18.5 18 18C13.5 17.5 8 19 5 16.5Z"
            fill="url(#orcaGrad)"
          />

          {/* Dorsal Fin */}
          <path
            d="M16 10.5C17.2 7 19.5 5 21.5 4.5C21 7.2 20 9.5 18.5 11"
            fill="#38bdf8"
          />

          {/* Tail flukes */}
          <path
            d="M5.5 16.5C4 14.5 2.5 13 1.5 13.5C2.2 15.5 3.2 16.8 5 17.2C3.2 17.8 2.2 19 1.5 20.8C2.5 21.5 4 19.8 5.5 17.8"
            fill="#2dd4bf"
          />

          {/* Eye spot */}
          <circle cx="23.5" cy="14" r="1.2" fill="#f0fdfa" />
          <circle cx="23.8" cy="13.9" r="0.6" fill="#030813" />

          {/* Sleek underbelly patch */}
          <path
            d="M13 17C17 16.8 21 16.2 24.5 15.2C23.5 16.5 21 17.5 18 17.5C16 17.5 14.5 17.2 13 17Z"
            fill="#ffffff"
            opacity="0.85"
          />
        </svg>
      )}
    </span>
  );
}
