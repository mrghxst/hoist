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
pnpm check            # svelte-check (TypeScript 6, strict), then the service worker
pnpm test             # Vitest units in tests/
pnpm test:e2e         # Playwright in e2e/ (starts preview on :4173)
pnpm size             # play-page JS budget (75 KB gzipped)
pnpm lighthouse       # Lighthouse CI on build/ (needs Chrome; CHROME_PATH works).
                      # The hard gate for performance and LCP: CI only warns
pnpm data             # the data pipeline (needs network on first run)
pnpm audit:data       # data audits on the committed files
node scripts/dev/flights.ts <dir> --gpu [--throttle]   # globe frame times
node scripts/dev/simulate.ts [days]                     # simulated learner
node scripts/dev/readme-shots.ts                        # README screenshots (needs pnpm preview)
node scripts/data/flag-update.ts check                  # flags changed on Commons (weekly workflow)
pnpm fonts            # re-subset Geist (needs Python fonttools + brotli)
pnpm icons            # app icons in static/icons/ from the favicon's mark
```

## SvelteKit 3 notes

- Config lives in `vite.config.ts`, passed to `sveltekit({...})`. There is no
  `svelte.config.js` any more.
- `$lib` is gone. Use the `#lib/*` subpath import from `package.json`, and
  write the extension: `#lib/brand.ts`, `#lib/store/theme.svelte.ts`,
  `#lib/ui/TopBar.svelte`.
- `tsconfig.json` must extend `$app/tsconfig` and keep `$app/types` in `types`.
- `output.preloadStrategy` was removed. Bundles are split (the default):
  `single` would inline the lazy globe chunk into the initial JS. A rolldown
  `codeSplitting` group in `vite.config.ts` puts the code every page needs
  into one chunk, and `scripts/postbuild.mjs` (run by `pnpm build`) adds a
  modulepreload for SvelteKit's root error page.
- Anything not needed for the first frame (globe, geometry, quiz data, quiz
  engine) starts after `afterFirstPaint()` (`#lib/ui/after-paint.ts`). Do not
  preload it in `<head>`: Lighthouse counts it against LCP.
- Quiz data is fetched (`#lib/data/game.json?url`), not imported, so it stays
  out of the play page's JavaScript. Pages that need full data read it in
  `+page.server.ts` at prerender time.

## Layout

```
src/app.html            shell; inline theme script (no flash), font preload
src/app.css             tokens (PROMPT.md 6.1), glass panels, base styles
src/lib/brand.ts        product name and domain (one place)
src/lib/flags.ts        proportions, the non-rectangular flag
src/lib/globe/          Globe class (Canvas 2D), sphere.ts renderer, camera,
                        data loading, palette from the CSS tokens
src/lib/match/          normalising, answer matching (countries, capitals), hints
src/lib/learn/          spaced repetition: grading, FSRS wrapper, session queue,
                        introduction order, planner, learner, store, schema
                        and migrations, export / import
src/lib/play/           the quiz: Game and decks, PlayScreen (shared by Play
                        and Practice), Reveal and Pick (lazy), the lazy
                        engine entry, scopes and practice modes
src/lib/data/           generated data (do not edit by hand), types.ts
src/lib/store/          localStorage access (storage.ts), theme state
src/lib/server/         prerender only: the catalog of flags and countries,
                        share images (resvg)
src/lib/ui/             TopBar, ThemeToggle, small components
src/routes/             /, /daily, /practice, /practice/[mode], /progress,
                        /flags, /flags/[slug] (+ og.png), /about,
                        /lookalikes, /og.png, /sitemap.xml, /robots.txt
src/service-worker/     offline: precache and fetch strategy; own tsconfig
static/fonts/           Geist subset (OFL), versioned file names
static/icons/           app icons (`pnpm icons`); the manifest is in static/
static/_headers         Cloudflare cache headers
wrangler.jsonc          Cloudflare Workers static assets from build/
tests/  e2e/            Vitest units, Playwright end-to-end
scripts/data/           the data pipeline (`pnpm data`), audits, static globes
scripts/dev/            screenshots and flight timings for local checks
data/                   curated inputs (overrides, aliases, lookalikes, ...)
reports/                generated review reports
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
- `pnpm preview` keeps the build it started with: restart it after
  `pnpm build`, or pages load old chunk names and fail.

## Agent skills

### Issue tracker

Issues live in GitHub Issues for `mrghxst/hoist` (`gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

The five default labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the root (created when needed), plus `docs/decisions.md`. See `docs/agents/domain.md`.
