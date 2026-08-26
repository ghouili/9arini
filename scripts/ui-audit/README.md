# scripts/ui-audit — the UI measurement harness

Seven runners, plus two verification helpers. Each exits non-zero on failure, so `npm run ui:audit` is a gate,
not a report you can talk yourself out of.

| script | what it proves | needs a server |
|---|---|---|
| `contrast.mjs` | every foreground/background pair the app renders clears WCAG 2.1 AA | no |
| `guardrails.mjs` | RTL uses logical properties only · FR/AR key sets identical · no hardcoded French · no untokenised colour | no |
| `nojs.mjs` | every public route shows h1 + sub-headline + primary CTA with **JavaScript disabled** | yes |
| `a11y.mjs` | zero serious/critical axe violations + skip link + 44px targets + 13px text floor, every route, **both locales** | yes |
| `keyboard.mjs` | Tab through every route: skip link first, every stop visibly ringed, no traps, no positive tabindex | yes |
| `lighthouse.mjs` | Performance >= 80 and Accessibility = 100, mobile, simulated 3G (**production build only**) | yes |
| `shots.mjs` | full-page screenshots at 320 / 380 / 768 / 1280, **plus** viewport-overflow and text-clipping detection | yes |
| `weight.mjs` | what a first-time visitor downloads per route, split by resource type (informational) | yes |

```bash
npm run dev -- -p 3111      # then, in another shell:
npm run ui:audit            # contrast + nojs + a11y
node scripts/ui-audit/shots.mjs
```

`UI_AUDIT_BASE` points the browser runners somewhere else (default
`http://localhost:3111`).

## Auditing a production build

Several defects only reproduce in a production build (streaming, Suspense
bail-outs, static vs. dynamic rendering), and `next.config.mjs` sets
`output: "standalone"` — which `next start` refuses to serve correctly. Use the
helper, which also mirrors `.next/static`, `public/` and `.env.local` into the
standalone bundle (Next does not copy those, by design):

```bash
npm run build
bash scripts/ui-audit/_restart-prod.sh /tmp/prod.log
UI_AUDIT_BASE=http://localhost:3222 npm run ui:audit
```

## `tune.mjs`

Not part of the gate. Given a brand hue and a set of surfaces it must sit on, it
finds the **lightest** shade that still clears the contrast floor — so an accent
passes AA without being darkened into mud. Used to derive the `--ochre-btn` /
`--green-ink` family in `globals.css`.

## Verifying that a refactor changed nothing

`to-tailwind.mjs` (the inline-style → Tailwind codemod) and any other mechanical
change are verified two ways, because pixels and geometry catch different things:

```bash
node scripts/ui-audit/shots.mjs --out=shots-baseline   # before
node scripts/ui-audit/geom.mjs  before.json            # before
# ...make the change...
node scripts/ui-audit/shots.mjs && node scripts/ui-audit/diff.mjs   # pixel-identical?
node scripts/ui-audit/geom.mjs "" before.json                       # geometry-identical?
```

`diff.mjs` compares SHA-256 of each PNG — Playwright's encoding is deterministic,
so equal hashes mean pixel-identical. `geom.mjs` dumps the box **and computed
style** of every element on every route and diffs those, which is what actually
localises a regression: a pixel diff says "storefront-fr-380.png changed", while
geom says "this `<p>` lost 12px of bottom margin".

Both were needed. The Tailwind conversion looked clean in review but geom.mjs
caught four real regressions a pixel diff alone would only have flagged, not
explained:

* `tracking-[0.6]` — `letterSpacing` is not a unitless property, so the utility
  was invalid CSS and silently dropped, narrowing a heading by 10px;
* `text-mint` / `text-on-blue` losing to `.trust .ic` / `.trust p` — Tailwind's
  `@layer` here is build-time ordering, not native cascade layers, so a utility
  (0,1,0) does **not** beat a component rule (0,2,0) the way an inline style did;
* `mb-0` losing to `.sf-empty-body`, which is injected unlayered via
  `dangerouslySetInnerHTML` and therefore outranks every Tailwind layer;
* `pb-0` losing to `.web-section.tight`, same specificity story.

That is the general hazard of this codemod: an inline style always wins, a
utility class does not. Anything it converts on an element that also carries a
component class has to be re-measured, not eyeballed.
