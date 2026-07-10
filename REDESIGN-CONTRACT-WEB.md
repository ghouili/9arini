# Web redesign contract (flagship screens)

Goal: redesign flagship screens into **full-width responsive web** (the landing-page pattern) while **preserving every bit of logic**. Mobile stays single-column and usable; tablet/desktop become full-width web with a top nav, max-width containers, and multi-column grids.

## Use the web shell (not the mobile Frame)
- Wrap the screen in **`<SiteShell>`** from `@/components/SiteShell` (it renders the responsive top nav + footer). Drop the mobile `<Frame>`, `<StatusBar>`, and `<BottomNav>` on these redesigned screens — the top nav serves all sizes.
- Compose content as: `<section className="web-section"><div className="container">…</div></section>`.

## Web classes available (in globals.css — don't edit it)
- Layout: `.container` (+ `.container-narrow`), `.web-section`, `.web-hero` (text+visual split), `.grid-2` / `.grid-3` / `.grid-auto`, `.cluster`, `.app-layout` + `.app-sidebar` + `.side-nav` (dashboard sidebar).
- Type: `.web-eyebrow`, `.web-h1`, `.web-h2`, `.web-lead` (all fluid via clamp).
- Surfaces: `.panel` / `.panel-pad`, plus the existing `.card`, `.btn*`, `.chip*`, `.balance`, `.zellige`, `.hero-blue`, `.avatar`, `.thumb`, `.metaline`, `.trust`, `.field`/`.inp`.
- Helpers: `.hide-mobile`, `.hide-desktop`.
- Brand: cobalt `--blue` + sand/cream + `--ochre` CTA + `--green`; Space Grotesk display, zellige texture. Reuse `@/components/ui` (Card, Button, Avatar, Chip, Field, Verified), `@/components/icons`, `@/components/LocaleToggle`, `useLocale`.

## NON-NEGOTIABLE — preserve all logic
Keep **every** import, hook (`useState`/`useEffect`), server-action call, data prop, `useLocale`, link `href`, and i18n key exactly. Only restructure **markup + styling** for responsive web + better UX. Do **not** change data flow, routes, auth, or break anything. Keep bilingual FR/AR + RTL (logical CSS props, `useLocale`), keyboard focus, labels, and aria.

## Quality bar
On desktop it must read like a real web product — full-width, multi-column, generous spacing, matching the landing's identity — and surface **all** the screen's features. On mobile it must gracefully stack to a clean single column. Screenshot-worthy at every width.

Do not edit shared files (`globals.css`, `SiteShell/Header/Footer`, `ui.tsx`, `icons.tsx`, `i18n.ts`, `lib/*`).
