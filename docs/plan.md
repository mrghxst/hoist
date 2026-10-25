# Plan

The milestones from [PROMPT.md](../PROMPT.md) section 14, kept current while
building. Choices the brief does not cover are in [decisions.md](decisions.md).

## M0: Foundation (done 2026-10-25)
- [x] SvelteKit 3 + Svelte 5 + static adapter, TypeScript 6 strict
- [x] Tokens (6.1), self-hosted Geist fonts (Latin subset), glass surfaces
- [x] Top bar (desktop links, phone menu), empty routes, 404
- [x] Light / dark / system theme, no flash on load
- [x] `CLAUDE.md`, CI workflow, Dependabot with the TypeScript rule
- [x] `wrangler.jsonc` (static assets from `build/`), `_headers`
- [x] Lighthouse 100 / 100 / 100 / 100 on the empty play page (LCP 1.36 s)
- [ ] Deploy: waiting on the owner (see "Owner steps")

## M1: Data pipeline (done 2026-10-25)
- [x] Countries (mledoze 5.1.0), set-197, aliases, self-designations
- [x] Flags from the Wikipedia infobox files on Commons, SVGO with a visual
      check, hashed names, WebP fallbacks (1.76 MB in all)
- [x] Capitals and largest cities (GeoNames) with sourced overrides
- [x] Geometry (Natural Earth 5.1.2): overview 102 KB, detail 518 KB, land
      dots 22 KB (all gzipped), views from the main landmass
- [x] Lookalike candidates report; 24 curated groups
- [x] Audits (4,256 checks, 0 errors) and reports, reviewed
- [x] `pnpm data` from an empty `data/raw` (240 s), spot checks, Syria 2025,
      Nepal not a rectangle, Qatar 28:11

## M2: The globe (done 2026-10-25)
- [x] Look: glass body, far side through the glass, dot field fading to the
      edge, solid land with hairline borders from zoom 2, graticule, rim, halo
- [x] Fly-to on one interruptible camera, framed on the main landmass
- [x] Markers, labels on opposite sides, two pulses, tiny-country rings
- [x] Drag (versor) with inertia, wheel/pinch/double-click zoom, arrow keys,
      reduced motion, idle rotation that pauses for 8 s
- [x] Detail geometry swap past zoom 1.8, static SVG globes (432 files)
- [x] Japan → Brazil → Monaco → New Zealand → France checked in light, dark
      and phone screenshots
- [x] Frame times 2.5 ms (budget 6), 10.1 ms at 4× throttle (budget 14)

## M3: The core loop (done 2026-10-25)
- [x] Flag card, answer field, matching (208 cases), result, globe reveal
- [x] Hints (Tab), give up (Esc), "Which one?" chips (number keys), `?` help
- [x] Keyboard loop; e2e: full starter round, wrong then right, Congo chips,
      typo accepted, no answer in the DOM, first flag in the HTML
- [x] Starter round for first visits, then "Learn all 197" or a region
- [x] Desktop and 375 px screenshots in light and dark reviewed
- [x] Phone layout with the on-screen keyboard open: e2e with a stand-in
      visualViewport, screenshots at 375×512 in light and dark
- [x] Lighthouse on the real play page: 100 / 100 / 100 / 100, LCP 1.36 s,
      CLS 0 (was LCP 3.0 s; see decisions)

## M4: Learning engine
- [ ] FSRS, grading, queue rules
- [ ] Review, Learn new, Region, Capitals, Reverse, Easy
- [ ] Progress store, migrations, export / import

## M5: Fun
- [ ] Daily with share, streaks, speed run, mastery globe
- [ ] Lookalike drills, streak glow, sound and haptics

## M6: Pages, offline, languages
- [ ] `/flags` grid, 197 flag pages with static globes and OG images
- [ ] `/lookalikes`, `/about` with credits
- [ ] Offline and install, "Also accept names in", sitemap, robots

## M7: Polish and launch
- [ ] Accessibility, performance, copy and visual passes
- [ ] Error states, 404, weekly flag-update workflow
- [ ] README with screenshots

## Owner steps

Things only the owner can do. Everything else is prepared in the repo.

### 1. Connect the repo to Cloudflare (M0)

1. In the Cloudflare dashboard: **Workers & Pages → Create → Import a
   repository**, pick GitHub, and authorise access to `mrghxst/hoist` only.
2. Settings for the Worker:
   - Project name: `hoist` (must match `name` in `wrangler.jsonc`)
   - Production branch: `main`
   - Build command: `pnpm install --frozen-lockfile && pnpm build`
   - Deploy command: `npx wrangler deploy`
   - Root directory: `/`
   - Build variables: `NODE_VERSION` = `24`, `PNPM_VERSION` = `10.34.6`
3. Save and deploy. The first build publishes to `hoist.<account>.workers.dev`.
   Non-production branches get preview URLs automatically.

### 2. Point the domain at it (M0)

1. Workers & Pages → `hoist` → **Settings → Domains & Routes → Add → Custom
   domain** → `hoist.itsanon.com`. The `itsanon.com` zone must be on the same
   Cloudflare account; Cloudflare creates the DNS record and certificate.
2. Check `https://hoist.itsanon.com` loads, and that
   `curl -sI https://hoist.itsanon.com/nowhere` returns `404`.

### 3. Repository settings (M0)

1. GitHub → Settings → Branches: protect `main`, require the `CI / ci` check
   once it has run green once.
2. GitHub → Settings → Code security: enable Dependabot alerts and security
   updates (version updates come from `.github/dependabot.yml`).
