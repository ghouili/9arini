# scripts/brand — brand asset pipeline

Everything in `public/` that carries the logo is **generated** from
`brand/logo-source.png` (the 1.18 MB master, deliberately outside `public/` so it
can never be served by accident).

```bash
npm run brand:build
```

| output | size | notes |
|---|---|---|
| `public/logo.png` | 34 kB | the mark, cropped and pre-sized to 368×256 — the master for `og.png` |
| `public/logo-white.png` | 12 kB | same mark, RGB replaced, **alpha untouched** |
| `public/logo.webp` | 6 kB | 109×76 lossless — what `components/Logo.tsx` actually renders, `unoptimized` |
| `public/logo-white.webp` | 3 kB | same, white |
| `public/favicon.ico` | 5 kB | 16/32/48, cobalt tile with the mark knocked out |
| `public/favicon-32.png` | 1 kB | same at 32px, for `<link rel=icon type=image/png>` |
| `public/apple-touch-icon.png` | 14 kB | 180×180, **full-bleed, no alpha** — iOS masks it itself and renders transparency as black |
| `public/og.png` | 137 kB | 1200×630 WhatsApp/Twitter/Facebook card |

## Two scripts, on purpose

**`build-raster.py`** (Pillow) does the pixel work, by hand when the logo
changes, not in CI.

**`build-og.mjs`** (Playwright) builds only the social card, because it contains
Arabic — `تنجّم`, `الحصة الأولى مجانية`. Pillow cannot shape Arabic here
(libraqm is absent), so it would render the letters unjoined and in the wrong
order. Chromium shapes it correctly, and Playwright is already a devDependency
from the UI-audit harness. The card's palette is read out of `app/globals.css`,
so it cannot drift from the design system.

## The constraint that shaped all of this

**The logo never goes through `/_next/image`.** It is on every page, above the
fold, and the header must not wait on an image optimiser. `sharp` is installed now
and the optimiser works (15 Sept: 120 concurrent cold AVIF encodes, no stall,
p95 2.7 s), but encoding pushed `/fr`'s HTML from 8 ms to 2.6 s, and an earlier
test run saw image requests hang without a reproduction since. So `logo.webp` is
pre-sized at 2× the header mark and served as a static file — 5.8 kB, against the
optimiser's 5.2 kB AVIF. Accepted risk: any future *content* image that does use
the optimiser inherits that CPU cost on a cold cache.

## When the logo changes

1. Drop the new master at `brand/logo-source.png`
2. `npm run brand:build`
3. Bump the `?v=` on `og.png` in `app/[locale]/layout.tsx` — WhatsApp and
   Facebook cache previews by URL, so without it tutors' links keep showing the
   old card
4. Re-check the favicon at true size: the mark is fine line art and dissolves at
   16px, which is why every icon is a filled cobalt tile rather than a bare mark
