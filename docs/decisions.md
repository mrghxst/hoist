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

## M4

**Easy mode counts with less weight** (PROMPT.md 2.4): a right pick is rated
Hard at best, never Good or Easy, so recognising a flag among four never
schedules it as far out as recalling it. A wrong pick is Again. Easy mode
feeds the main flag card; it has no card of its own.

**New cards get a study card first, in every mode.** Learn new (7.2) shows
each new flag with its name, flight and capital, then quizzes the five in
mixed order. Play, Region, Capitals, Reverse and Easy introduce their new
cards the same way, five at a time, so no mode asks for something never
shown. The study card has no answer field.

**The daily new-card limit is per mode.** Ten new flags, ten new capitals
and ten new reverse cards a day (setting: 5, 10, 20, 30). Learn new is an
explicit request for five new flags and ignores the limit (it still counts
toward it).

**The starter round is a warm-up.** Its ten well-known flags are scheduled
like any answers, but do not use up the day's new flags, so picking "Learn
all 197" or a region right after it starts with new flags.

**Nothing due, nothing new: extra practice.** A session with nothing to do
offers the 20 seen cards least likely to be recalled (lowest FSRS
retrievability). FSRS handles early reviews, so these answers are scheduled
normally.

**An Again with no other card left** cannot come back "after 3 to 6 other
cards": it stays due and opens the next session.

**Queue interleaving** (3.2): when picking the next card the queue looks at
the next four and takes the first that is not "near" the last flag shown:
same lookalike group, or same region sharing two colours. Without such a
card it takes the first that is not the same flag. Most overdue still comes
first in practice; the lookalike drill (M5) turns interleaving off.

**Introduction order** (7.2): the 40 hand-picked familiar flags in their
order, then easy to hard by estimated difficulty, then by the population of
the largest city. Batches of five never hold two members of one lookalike
group; a flag that would clash waits for the next batch.

**Mastery levels** (2.5): untouched (never answered), learning (in learning
or relearning), known (in review), mastered (in review with a stability of
21 days or more).

**Progress store** (3.4): one object under `hoist:v1` with `v`, `settings`,
`cards` (`flag:JP`, `capital:JP`, `reverse:JP`; FSRS state with short keys),
`days` (per local date: answers, right, new per mode) and `updated`. 197
countries × 3 modes with a year of days stays under 200 KB (tested).
Settings are written on their own (`writeSettings`) and the card store
never writes them, so a stale copy cannot undo a theme change made in
between. Other tabs' saves are picked up through the `storage` event. A
store written by a newer version is read but never overwritten. Migrations
are pure functions (`src/lib/learn/schema.ts`); v0 is the M0–M3 shape
(settings only).

**Import merges** by most recent review per card; days keep the larger
counts; settings already set here stay, missing ones come from the file.
Reset keeps the settings.

**Capitals mode accepts** the capital, its listed alternatives (La Paz,
Cape Town, Bloemfontein, Lobamba, Malabo), and for "… City" capitals the
name without "City" (Mexico, Kuwait, Panama, Guatemala, Vatican), with the
same typo rules as country names. Naming another country's capital is wrong
and says whose capital it is.

**Reverse mode** highlights and flies to the country with no labels, so the
capital's name cannot give the answer away; the labels and the flag appear
after the answer. The optional "pick its flag from four" step is left for
later; the brief marks it optional.

**Practice routes** are prerendered: `/practice` (cards with counts, and the
settings: what Play covers, new flags per day, territories) and
`/practice/[mode]` for review, learn, capitals, reverse, easy and the seven
regions. Lookalikes and Speed run come with M5. A first version of
`/progress` has the totals and export, import and reset; M5 adds the
mastery globe, calendar and hardest flags.

**`aria-busy` on the quiz console** marks it as loading until the quiz data
and engine are in; the end-to-end tests wait on it.

### Keeping the play page fast as it grew

The play screen became a shared component (`PlayScreen.svelte`) for Play
and every practice mode. What only shows once the quiz runs (the study and
result panel, `Reveal.svelte`, and Easy mode's options, `Pick.svelte`) loads
with the lazy engine, not in the initial JavaScript. The engine
(`src/lib/play/engine.ts`) holds the game, decks, learner, scheduler
(ts-fsrs) and those parts, and loads after first paint.

Lighthouse's simulated LCP depends on how many round trips the largest
early file needs (it models TCP slow start per connection). One 25 KB
shared chunk ended at 1.506 s; splitting it into the Svelte runtime and the
app's shared code (two `codeSplitting` groups, each under about 18 KB
gzipped) brought LCP back to 1.36 s. Rolldown's `maxSize` split it into 38
tiny files instead and made it worse (2.0 s).

`/practice/[mode]` reads its mode in `+page.server.ts` (at prerender time)
rather than `+page.ts`: a universal load made SvelteKit import that module
as a namespace, which pulled rolldown's tiny helper into a chunk of its own,
one more request before first paint.

Turning the geometry into shapes, and setting up the quiz, now happen in a
few short tasks (`prepareInSteps`, yields in `PlayScreen`) instead of one
40 ms task, and the capitals index is built on the first capital question.
Total Blocking Time went from 140–200 ms to under 10 ms.

**Idle rotation stops on devices that cannot draw it cheaply.** If even the
quickest of the first three idle frames takes over 12 ms, the globe stays
still until the player moves it (as with reduced motion). With a GPU the
canvas draws in about 4 ms a frame here and keeps turning. Chrome without a
GPU, like the CI runner, draws it on the main thread at 15–50 ms a frame,
and Lighthouse counted every frame as blocking: Performance was 72–75 in CI
while LCP passed. 12 ms is where a frame becomes a "long task" under
Lighthouse's 4× CPU slowdown. CI now uploads the Lighthouse reports.

A first version timed only the JavaScript drawing, which was 3 to 4 ms in
CI too, and CI stayed at Performance 74 with TBT 1.5 s. The CI summary and a
local run with `--disable-gpu` showed why: without a GPU each frame also
spends about 11 ms in Chrome's "Commit" on the main thread, uploading the
canvas, after the frame callback. The guard now adds that part: a message
posted at the end of the frame callback runs only once the frame is
rendered. With a GPU the extra is about 0.2 ms. Detecting software
rendering through WebGL was tried and dropped: SwiftShader passes
`failIfMajorPerformanceCaveat`, and creating the context took 130 to 240
ms. Without a GPU Lighthouse is now 100 with TBT 40 ms.

`scripts/postbuild.mjs` now also patches SvelteKit's own copy of the
prerendered pages, which `vite preview` serves, so preview and the
end-to-end tests match what ships.

## M5

**The daily keeps flags apart for 14 days, not 30.** The brief asks for
"never repeating within 30 days", which cannot hold: 30 days of ten flags
is 300 and there are 197. Each day takes two easy, three medium and five
hard flags (from 40, 54 and 103); the longest gap that can always be kept
with that mix is 17 days, and 14 leaves some choice every day. Each day's
set is chosen with a seed from the UTC date, after leaving out the last 14
days' flags, so the sets are computed in order from 2026-10-01. Same date,
same data, same ten flags everywhere (unit-tested over a year). A round
starts easy and ends hard.

**One attempt a day, resumable.** The daily is saved after every answer,
so a reload carries on where it stopped instead of starting over (which
would also let a player see the flags twice). A finished daily opens on
its result.

**The clock counts answering time only**, for the daily and speed runs:
from a flag appearing to its answer. Reading a result does not cost time.

**Share:** "Copy result" everywhere, plus "Share" (the Web Share API) on
touch devices. The page shows the ten results as monochrome squares (right
solid, with help half-filled, wrong outlined in red); the colourful emoji
are only in the shared text, as the brief writes it.

**Two streaks.** The daily streak counts UTC days with a finished daily
(Daily page, Progress). The practice streak counts local days with any
answer (Progress). Play's header keeps the in-session "right in a row"
count, which drives the glow at 10.

**Daily and speed-run answers are scheduled** like any others (every
minute should move flags into memory, 1.3), but as warm-ups: flags seen
there for the first time do not use up the day's new flags.

**Speed run:** pick All 197 or a continent; flags shuffled; a right answer
moves on by itself after 450 ms; a wrong one waits for Enter. The best run
per scope is kept: most right, then fastest.

**Lookalike drills:** the four groups the player knows least (average
recall of their members), each group's flags back to back with the
interleaving turned off, unseen members studied first. After every answer
the group's tip ("How to tell") is shown. The tip also appears in every
mode when a wrong answer named a flag from the same group. `/practice/drill
?ids=TD` drills the groups of given flags: the "Drill" buttons in "Hardest
for you" on Progress use it.

**Progress page:** the mastery globe (the same four tints as the legend,
zoomed so the land is solid), totals, both streaks, a 12-week calendar
strip (shade by answers: none, under 10, under 30, 30 and more), the five
flags with the most misses (lapses) with Drill buttons, and best speed
runs. The globe there has no zoom buttons: on phones they covered it, and
drag, pinch and the keys still work.

**Sound and haptics:** sound off by default, a 70 ms triangle tick at
1,320 Hz for right and a 220 ms sine at 196 Hz for wrong, made with the Web
Audio API. Vibration on by default, 10 ms on a right answer. Both are in
Practice's settings and load with the engine.

**Schema v2** adds `daily` (by UTC date) and `best` (by scope). Migrations
are now steps v0 → v1 → v2 on the raw object, each a pure function, then
one clean-up; import keeps the first daily recorded and the better best.

## M6

**Offline with SvelteKit's own service worker, not `@vite-pwa/sveltekit`.**
The brief names vite-pwa, but its SvelteKit plugin only supports kit 1 and 2,
and this is kit 3. `src/service-worker/index.ts` does the same job in about
90 lines, with its own `tsconfig.json` so the worker's types stay out of the
app.
- On install it caches the app files (hashed), the pages people play on
  (not the 216 flag pages, the images or the XML), the fonts, the icons, the
  manifest, the overview geometry and land dots, and every flag the quiz
  shows (read from the quiz data it has just cached). Flag pages, their
  static globes and the detailed geometry are cached when visited.
- Pages are network first (a new version shows when online), then the
  cache, then the home page. Everything else is cache first.
- SvelteKit's prerendered list leaves out `/`, so the worker adds it.
- Cache lookups ignore `Vary`: `vite preview` sends `Vary: Origin` and
  module scripts send an Origin, which turned every cached script into a
  miss offline. The files are static and same-origin, so this is safe.

**Install:** `static/manifest.webmanifest` (standalone, white) and icons from
`pnpm icons` (`scripts/icons.mjs`): the favicon's flag on a pole, white on
black; the maskable icon keeps the mark inside the middle half.

**23 languages, not 24.** The brief says the data has translations in 24;
REST Countries has 23 (Arabic, Chinese, Croatian, Czech, Dutch, Estonian,
Finnish, French, German, Hungarian, Italian, Japanese, Korean, Persian,
Polish, Portuguese, Russian, Serbian, Slovak, Spanish, Swedish, Turkish,
Urdu). All 23 are offered.

**English wins over translations.** A translated name that is another
country's English name is not accepted for this one (Polish lists "Sudan"
for South Sudan). The translations (210 KB) load only when a language is
turned on, and are in place before the first answer is checked.

**Flag pages:** one per flag, 216 (197 countries and 19 territories), at
`/flags/<slug>`. Each has the flag at its true size, the name and official
name, capital, largest city with population (GeoNames), region and
subregion, proportions as height to width (`2:3`), the other accepted
names, the description, a static globe (light and dark SVGs, so no
JavaScript), its lookalike groups with tips, and the flag's author and
licence.

**Share images:** 1200×630 PNGs made at build time with resvg and the Geist
TTFs from the `geist` package: flag, small globe and name for each flag
page; a grid of well-known flags for the site (`/og.png`).

**Nepal has no hairline.** The hairline is a rectangle and Nepal's flag is
not one. FlagImage drops it for any flag taller than it is wide (only
Nepal), which it knows from the ratio already in the page, so the quiz DOM
still names no country. The share image does the same.

**`/flags` uses chips, not a `<select>`, for sorting.** Svelte's `<select>`
helper went into the runtime chunk every page loads, which pushed it over
the ~16 KB slow-start step and the play page's LCP to 1.51 s. Chips match
the region filter anyway. On phones the region chips are one row that
scrolls sideways. The level dots load after first paint.

**Sitemap and robots** are prerendered endpoints that use `ORIGIN` from
`#lib/brand.ts` (222 URLs: the pages and the 216 flags).

**Removed `d3-inertia`:** the globe's drag has its own inertia since M2.
