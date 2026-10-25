# Hoist: working on the code

[PROMPT.md](PROMPT.md) is the product brief and the source of truth.
[docs/plan.md](docs/plan.md) tracks the milestones, [docs/decisions.md](docs/decisions.md)
records every choice the brief does not cover, and [docs/research.md](docs/research.md)
holds the verified facts behind the brief.

## Commands

```sh
pnpm install          # pnpm 10, pinned in packageManager
pnpm dev              # dev server on :5173
pnpm build            # static site into build/
pnpm preview          # serve build/ on :4173
pnpm check            # svelte-kit sync + svelte-check (TypeScript 6, strict)
pnpm test             # Vitest units in tests/
pnpm test:e2e         # Playwright in e2e/ (starts preview on :4173)
pnpm size             # play-page JS budget (75 KB gzipped)
pnpm lighthouse       # Lighthouse CI on build/ (needs Chrome; CHROME_PATH works)
pnpm data             # the data pipeline (M1)
pnpm fonts            # re-subset Geist (needs Python fonttools + brotli)
```

## SvelteKit 3 notes

- Config lives in `vite.config.ts`, passed to `sveltekit({...})`. There is no
  `svelte.config.js` any more.
- `$lib` is gone. Use the `#lib/*` subpath import from `package.json`, and
  write the extension: `#lib/brand.ts`, `#lib/store/theme.svelte.ts`,
  `#lib/ui/TopBar.svelte`.
- `tsconfig.json` must extend `$app/tsconfig` and keep `$app/types` in `types`.
- `output.preloadStrategy` was removed. We use `output.bundleStrategy: 'single'`
  (see decisions).

## Layout

```
src/app.html            shell; inline theme script (no flash), font preload
src/app.css             tokens (PROMPT.md 6.1), glass panels, base styles
src/lib/brand.ts        product name and domain (one place)
src/lib/store/          localStorage access (storage.ts), theme state
src/lib/ui/             TopBar, ThemeToggle, small components
src/routes/             /, /daily, /practice, /progress, /flags, /about, /lookalikes
static/fonts/           Geist subset (OFL), versioned file names
static/_headers         Cloudflare cache headers
wrangler.jsonc          Cloudflare Workers static assets from build/
tests/  e2e/            Vitest units, Playwright end-to-end
scripts/                size budget, font subsetting, data pipeline (M1)
```

## Rules of thumb

- Plain CSS with the tokens. No UI library, no CSS framework, no state library.
- Flags are the only colour. The accent is for the globe highlight, mastered
  countries and focus rings.
- Glass panels use the `.glass` class: translucent, blurred, hairline border,
  1 px top edge. No drop shadows.
- Every screen is composed around the middle of the viewport.
- Wrap every storage access in try/catch (`src/lib/store/storage.ts`).
- Never leak the answer: not in image URLs, alt text, the title, or the DOM.
- Look at changes in a browser in light and dark, at 375 px and 1440 px.
