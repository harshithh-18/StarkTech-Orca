/**
 * The ORCA mark.
 *
 * Owner: D · Phase: P4
 *
 * One component for every place the brand appears — the header, the welcome screen, the
 * agent avatar on an answer — so the mark can never be three slightly different things.
 *
 * ## The dark tile is not decoration
 *
 * The supplied artwork is a raster with a dark background and a glow around the whale.
 * Dropped straight onto a white header it shows as a black rectangle with a halo. So the
 * mark is always set inside a rounded, near-black tile, in **both** themes: the artwork's
 * own background then blends into the tile instead of fighting the page, and the mark
 * reads identically in light and dark. That is a deliberate design decision, not a
 * workaround — a dark chip is how most marine and aviation consoles present a badge.
 *
 * Swap in a transparent PNG or SVG at the same path and it will still look right; the tile
 * simply becomes the mark's backdrop rather than hiding a background.
 *
 * ## The fallback
 *
 * If the file is missing the component draws a small inline mark instead of a broken
 * image. Referenced by URL from `public/` rather than imported, so a missing file is a
 * cosmetic fallback at runtime and never a failed build.
 */

import { useState } from "react";

/** Where the artwork lives. `public/` is copied verbatim into the build. */
export const LOGO_SRC = "/orca-logo.png";

interface Props {
  /** Rendered tile size in px. */
  size?: number;
  /** Rounding of the tile. Matches the surrounding controls. */
  rounded?: string;
  className?: string;
}

export default function Logo({ size = 32, rounded = "rounded-lg", className = "" }: Props) {
  const [failed, setFailed] = useState(false);

  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className={`grid shrink-0 place-items-center overflow-hidden bg-abyss-950 ${rounded} ${className}`}
    >
      {failed ? (
        // A whale silhouette over a wave — enough to be recognisable at 32 px while the
        // real artwork is missing, and never a broken-image icon.
        <svg viewBox="0 0 24 24" width={size * 0.7} height={size * 0.7} aria-hidden="true">
          <path
            d="M3.2 12.4c2.6-3.4 6-5.1 10.2-5.1 3.6 0 6.1 1.7 7.4 5.1-1.3 3.4-3.8 5.1-7.4 5.1-4.2 0-7.6-1.7-10.2-5.1Z"
            fill="#22d3ee"
            opacity="0.9"
          />
          <path
            d="M13.4 7.3c.4-1.7 1.5-3 3.3-3.9-.5 2-.4 3.6.3 5"
            stroke="#67e8f9"
            strokeWidth="1.4"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="16.4" cy="11" r="0.9" fill="#060b14" />
          <path
            d="M2 19.4c2 0 2-1.6 4-1.6s2 1.6 4 1.6 2-1.6 4-1.6 2 1.6 4 1.6 2-1.6 4-1.6"
            stroke="#0891b2"
            strokeWidth="1.3"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      ) : (
        <img
          src={LOGO_SRC}
          alt=""
          width={size}
          height={size}
          onError={() => setFailed(true)}
          // `scale-[1.35]` crops into the artwork: the supplied file is a wide canvas with
          // the wordmark below the mark and a lot of margin around it. At 32 px the mark
          // has to fill the tile, or it reads as a speck in a black square.
          className="h-full w-full scale-[1.35] object-contain"
        />
      )}
    </span>
  );
}
