# Decisions

Choices the brief does not cover, or where the build deviates from it, with the
reason. Newest at the bottom of each milestone.

## M0

**Glass and a centred stage (owner request, 2026-10-25).** The owner asked for
the interface to feel "glassy" and "driven by the middle of the screen, really
modern". The brief's Vercel-style minimalism stays (black and white, Geist,
hairlines, flags as the only colour), with these additions:
- Panels use a `.glass` class: translucent background, `backdrop-filter`
  blur, hairline border and a 1 px inner top edge. This is the only
  "shadow"-like effect; there are still no drop shadows. Browsers without
  `backdrop-filter` get a more opaque background.
- The page is lit from the centre: a soft radial glow plus a faint dot grid
  that fades out toward the edges (monochrome, so the colour rule holds).
- The top bar is a floating glass pill. The wordmark stays left and the theme
  toggle right, as in the brief, but the links sit in the middle.
- Screens are composed around the centre of the viewport. For the play page
  this changes the brief's left/right split (2.1); see M3.

**SvelteKit 3 idioms.** Kit 3.1.0 removed `svelte.config.js` (config is passed
to `sveltekit()` in `vite.config.ts`), removed `$lib` in favour of the `#lib/*`
subpath import, and removed `output.preloadStrategy`. We follow the new idioms
instead of adding a `$lib` alias back.

**Single bundle for now.** With Kit's default split output, the empty play
page loaded 12 small modules and Lighthouse's simulated 4G gave LCP 1.68 s
(budget 1.5 s, Performance 99). `output.bundleStrategy: 'single'` gives one
JS and one CSS file: LCP 1.36 s, all four categories 100. Revisit in M3 and M7
once the play page has its real weight; the globe must still load after first
paint, so if `single` inlines it, switch back to `split` and cut requests
another way.

**Fonts subset and served from `static/fonts/`.** The `geist` package only
exports its Next.js loader, so the WOFF2 files cannot be imported. The variable
fonts are subset to Latin, Latin-1, Latin Extended-A, Romanian comma letters
and the symbols we use (`scripts/fonts/subset.sh`, fonttools). Sans drops from
69 KB to 29 KB. Files carry the package version in their name so they can be
cached as immutable, and the sans file is preloaded first in `<head>`, before
the module preloads. Other scripts (Cyrillic, CJK) fall back to system fonts,
which only matters for the optional "accept names in" languages.

**pnpm 10.34.6.** The brief says pnpm 10.x; 10.34.6 is the newest 10.x that is
at least two weeks old.

**HTML caching.** Cloudflare's static assets already send
`Cache-Control: public, max-age=0, must-revalidate` for HTML, which behaves
like `no-cache`. `_headers` only adds the one-year immutable rule for hashed
assets, fonts and flags, because Cloudflare merges matching `_headers` rules
and a `/*` `Cache-Control` would also apply to the immutable files.

**404.** The static adapter writes `404.html` as a fallback page, and
`wrangler.jsonc` uses `not_found_handling: "404-page"`, so unknown paths get a
real 404 status with the styled error page.

**Lighthouse locally** uses Playwright's Chromium via `CHROME_PATH`. In CI the
runner's Chrome is used. Lighthouse 12 has no `mobile` preset; the default
settings are the mobile emulation the brief asks for.

## M1

**Flag files come from the Wikipedia infobox.** `pnpm data --discover` reads
`image_flag` from each country's English Wikipedia infobox and writes the
Commons file name to `data/flag-sources.json`, which is then reviewed and
committed. Several infobox files are variants with exact colours or
proportions (`Flag of the United Kingdom (1-2).svg`, `Flag of Canada
(Pantone).svg`, `Flag of Iran (official).svg`). Honduras uses `Flag of
Honduras (1949–2022, 2026–present).svg`, matching its 2026 return to the
earlier flag.

**Afghanistan shows the flag used in the country today.** The Wikipedia
infobox uses the Islamic Emirate's white flag (`Flag of Taliban.svg`), so the
quiz does too, following the brief's rule for choosing files. The flag page
will add one neutral line: the black, red and green tricolour of 2013–2021 is
still used at the United Nations and by some embassies. This is a judgement
call the owner may want to revisit.

**Equatorial Guinea's capital is Ciudad de la Paz.** GeoNames marks it as the
capital, and a presidential decree of 2 January 2026 moved the capital there
from Malabo (Wikipedia, Financial Afrik, checked 2026-10-25). mledoze 5.1.0
still says Malabo. The override shows Ciudad de la Paz with a note that most
government offices are still in Malabo, and the capitals mode accepts both.

**Qatar's proportions come from width/height.** Its Commons file stretches a
75×18 viewBox to 1400×550 with `preserveAspectRatio="none"`. The ratio rule
is "viewBox, unless the root stretches it", which gives Qatar 28:11.

**SVGO precision is chosen per flag.** Each flag is optimised at 1, 2, then
3 decimal places, and the first result whose render matches the original
(mean difference ≤ 1.5/255 at 160 px and ≤ 0.3/255 at 480 px, via resvg)
ships. This brought the whole set from 2.9 MB to 1.76 MB. Pakistan needed the
conservative preset. The WebP fallbacks use quality 72 at 960 px.

**Detail geometry is quantised at 1e6.** At 1e5, Vatican City collapsed to a
zero-area line, so no point could be inside it. 1e6 with 28% simplification
gives 518 KB gzipped (target 600 KB). The overview uses 1e5 and 6% (102 KB).

**Translations live in their own file.** `translations.json` (23 languages;
mledoze 5.1.0 has no Breton, so 23 rather than 24) is separate from
`countries.json`, so the play page only loads it when the player turns on
"Also accept names in".

**New Caledonia is left out of the territories pack.** Its infobox image shows
two flags side by side (ratio 3.5), and choosing one would be a political
statement.

**Populations are GeoNames figures**, also for overridden largest cities
(city proper, sometimes outdated). They are credited to GeoNames.

**Difficulty is estimated.** There is no usage data yet, so: 40 hand-picked
familiar flags are easy (`data/starter.json`); countries in the top 110 by
population that are in no lookalike group, or in the top 50 overall, are
medium; the rest are hard. That gives 40 / 54 / 103.

**More lookalike groups.** The candidate report surfaced Türkiye/Tunisia
(distance 0.098), Fiji/Tuvalu and Italy/Mexico, which were added with tips.

**`tiny` uses a phone-sized globe.** A country is `tiny` when its main
landmass is under 20 px across at its framed zoom on a 170 px-radius globe.
That is 39 countries, including Cyprus, Kosovo and Luxembourg; the globe also
checks the real on-screen size at run time.

## M2

**A small sphere renderer instead of d3's projection streams.** Drawing land,
borders and the far side through `geoPath` cost 19–35 ms per frame, mostly
d3 re-testing every ring with spherical trigonometry and adaptive resampling.
`src/lib/globe/sphere.ts` turns every vertex into a unit vector once; a frame
then costs a few multiplies per vertex. Rings are clipped at the horizon and
the visible pieces are rejoined along the rim, the same way d3's clipRejoin
works (an earlier version that followed the hidden vertices round the rim
broke when they passed near the centre of the disc). The far side is the same
projection with the visibility test flipped, which `tests/sphere.test.ts`
checks against d3's `reflectX` projection from the brief. d3 is still used to
invert pointer positions while dragging. This is still Canvas 2D; no WebGL.

**Lighter outlines while moving.** During flights, drags and inertia the land
uses every 3rd vertex, borders every 4th and the far side every 8th; the full
outlines come back at rest.

**Frame times** (production build, five flights Japan → Brazil → Monaco →
New Zealand → France, `scripts/dev/flights.ts`): mean 2.5 ms, p95 4.0 ms; with
4× CPU throttling mean 10.1 ms, p95 15.5 ms. Measured in headless Chromium
with GPU rasterisation on (`--gpu`), since a real laptop rasterises canvas on
the GPU; headless Chromium otherwise uses SwiftShader. Budgets: 6 ms and 14 ms.

**Denser land dots.** The Fibonacci lattice has 40,000 points instead of
about 20,000; at 20,000 the continents read as a sparse grid. 11,518 dots,
42 KB gzipped, overview plus dots 144 KB (budget 180 KB).

**Globe size.** The radius at zoom 1 is 40% of half the smaller side of the
stage, so at zoom 2.5 the globe just fits and its edge stays in view. The play
page starts at zoom 1.35 so the idle globe is not small.

**Split bundles after all.** M0 used `bundleStrategy: 'single'` to get LCP
under budget on the empty page, but `single` inlines dynamic imports, which put
the globe and all data in the initial JS (99 KB). Back to split output, with
the globe as a lazy chunk and quiz data fetched as a hashed JSON file: the play
page's initial JS is 38.8 KB gzipped. LCP is re-checked in M3.

**Static globes** are 240 px SVGs with a 7,000-point lattice, dots drawn as
zero-length square-capped subpaths, and a coarse graticule: 17.7 KB average,
432 files. Flag pages show the light or dark one by theme.

## M3

**Play layout: a centred glass console.** Following the owner's "middle of the
screen" direction, the globe fills the stage and is centred (moved up 90 px on
desktop), and a wide glass console sits centred at the bottom: the flag on the
left, the answer and result on the right. On phones the globe takes the top
45% and the console rides above the keyboard, as the brief describes.

**The globe's focus target** is a wrapper with `role="application"` and the
view description as its label; the canvas itself is `aria-hidden`. A
focusable canvas cannot also be `role="img"`.

**`?deck=CD,CG`** plays a fixed list of flags. The end-to-end tests use it to
reach specific flags; it reveals nothing the player does not see anyway.

### Getting the play page to Lighthouse 100 and LCP ≤ 1.5 s

Lighthouse's mobile score is simulated (Lantern): it takes every request that
started before the observed first paint and replays it on a slow 4G link
with 6 connections. In its headless Chrome the first frame lands at about
450 ms whatever the page does, so anything requested in that window counts
against FCP and LCP. With the globe and data preloaded, LCP came out at
3.0 s. What fixed it, in order of effect:

- **Heavy work starts after first contentful paint** (`afterFirstPaint()` in
  `src/lib/ui/after-paint.ts`, a `PerformanceObserver` with a 1.5 s
  fallback): the globe module, the geometry, the quiz data and the quiz
  engine. The brief's tactic "preload the overview geometry" now means
  "fetch it right after first paint", not `<link rel="preload">` in `<head>`:
  a head preload competes with the first paint.
- **The input placeholder is fixed** ("Type the country"). It was "Loading
  flags…" until the data arrived, which made a second, late LCP.
- **The field takes typing at once.** It is uncontrolled until the game
  exists, so what was typed before hydration or before the data survives;
  Enter pressed early is checked once the data is in; `method="dialog"`
  makes an Enter before hydration a no-op instead of a page reload. The
  field has `aria-busy` while loading.
- **Flags are sized by CSS** (`--flag-w`, `--flag-h` per breakpoint), not by
  a JavaScript width check, so the prerendered HTML is right on phones. The
  phone flag was resized on hydration: a 0.006 layout shift.
- **SvelteKit's root error page is preloaded** with the other modules
  (`scripts/postbuild.mjs`). SvelteKit imports it on every start but only
  finds it after its runtime loaded, the last link in the chain. Its styles
  moved to `app.css` so it brings no CSS file.
- **One shared chunk** for the code every page needs at first paint
  (rolldown `codeSplitting` group: initial modules used by two or more
  entries, SvelteKit's runtime kept apart because SvelteKit looks it up).
  13 JS files became 6.
- **Fonts:** the weight axis is cut to 400–600, the only weights used (still
  variable). Geist is split with `unicode-range`: a 17.4 KB core (Latin-1,
  punctuation, the UI symbols) that is preloaded, and an 8.4 KB Latin
  Extended file fetched only when such a letter shows. Keycaps use Geist,
  not Geist Mono, so the mono file is not needed for the first screen; the
  brief only asks for tabular numbers, which Geist has. A metric-matched
  fallback face (`Geist Fallback`, Arial or Liberation Sans scaled to
  Geist's widths and line metrics) keeps a late font swap from moving text.
- **The favicon is inline** (a data URI), one request fewer.

Result: Performance, Accessibility, Best Practices and SEO 100; LCP 1.36 s,
CLS 0, TBT 90 ms; play page initial JS 42.8 KB gzipped.

**On-screen keyboard check.** Chromium cannot open a virtual keyboard under
test, so the e2e test stands in a fake `visualViewport` that shrinks by
300 px and checks the console's bottom edge stays above it. Screenshots at
375×512 (812 minus a keyboard) were reviewed in light and dark. On short
screens the flag card is 96 px and the flag fits inside it (it overflowed
before).
