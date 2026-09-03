# `frontend/public/`

Files here are copied verbatim into the build and served from the site root.

## `orca-logo.png` — **required, not in the repo**

The ORCA brand mark. Referenced by `components/common/Logo.tsx` (header, welcome screen,
answer avatar, reasoning-trace header) and by `index.html` as the favicon and Apple touch
icon.

Save the artwork here as `orca-logo.png`. A square crop of the mark alone — no wordmark —
works best; `Logo.tsx` scales into the image, and the wordmark is already set in text
beside it. Either a dark-background raster or a transparent PNG/SVG is fine: the mark is
always drawn inside a near-black rounded tile, so an artwork with its own dark background
blends into it rather than showing as a black rectangle on a white header.

Until the file exists, `Logo.tsx` draws a small inline whale mark instead — the build
succeeds and nothing renders broken.
