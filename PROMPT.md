# Hoist: master prompt

> Copy everything below this line into a new Claude Code session, started in an
> empty folder (or in a clone of this repo). It is the complete brief: build the
> whole product, milestone by milestone, without asking for approval between
> milestones. Ask only when something below is impossible or contradicts itself.

---

You are building **Hoist**, a website for learning every flag of the world. The
name comes from the hoist, the part of a flag next to the pole.

The research behind this brief was done on 2026-10-25 and is recorded in
`docs/research.md` in this repository. Where this brief gives a version, a
count or a data quirk, it was checked on that date. Check versions again when
you start (`npm view <pkg> version`) and use the newest release that is at
least two weeks old, unless this brief says otherwise.

## 0. How to work

1. Read this whole brief before writing code. Then create `docs/plan.md` with
   the milestones from section 14 as a checklist, and keep it current.
2. Build the milestones in order (M0 to M7). Each milestone ends with its
   acceptance checks passing, a commit, and a push. Do not stop between
   milestones to ask for approval.
3. Commit in small, working steps with conventional commit messages
   (`feat(globe): ...`, `fix(data): ...`).
4. When you have to choose something this brief does not cover, pick the
   simplest option that keeps the product fast and minimal, and write the
   choice and the reason in `docs/decisions.md`.
5. Look at your work in a real browser after every visual change, in light and
   dark mode and at 375 px and 1440 px width. Screenshots are the test for
   "looks amazing"; type checks are not.
6. Never fetch data at runtime from third-party services. Everything the site
   needs is built at build time and served from our own origin.
7. `CLAUDE.md` in the repo root holds the layout and commands for working on
   the code. Create it in M0 and keep it current.

## 1. The product

### 1.1 Who it is for

People who want to really know the flags of the world: students, travellers,
quiz and geography fans, GeoGuessr players. They come back for five minutes a
day. They should love it, not grind through it.

### 1.2 The core loop (the heart of the product)

1. A flag is shown, large and in full colour, in its true proportions.
2. The player **types** the country's name. There is no multiple choice in the
   main mode, because recalling and typing a name makes it stick far better
   than recognising it in a list (see 3.1).
3. On Enter, the answer is checked, forgiving typos and accepting other names
   (section 5).
4. **The globe answers.** A semi-transparent glass globe turns and flies to the
   country, lights it up, and marks:
   - the **capital**: a solid dot with a short pulse and a label (`★ Tokyo`)
   - the **largest city**: a small hollow dot with a quieter label
   - if the capital is also the largest city, one marker with the label
     `Tokyo · capital and largest city`
5. Below the flag the result appears: the name, right or wrong, capital and
   largest city, and on a wrong answer, which flag the player confused it with
   (if they typed another country's name).
6. Enter again moves to the next flag. A round never needs the mouse.

This loop must feel instant and satisfying. The globe flight is the reward
moment. Spend most of the polish budget on it.

### 1.3 Principles

1. **Minimal, Vercel style.** Black and white interface, Geist type, thin
   borders, lots of space. **Flags are the only colour on the page**, plus one
   accent for the globe highlight and focus rings.
2. **Fast.** The play screen is interactive in under a second on a mid-range
   phone on 4G. No layout shift. No spinner after the first load.
3. **Efficient learning.** Spaced repetition decides what to show next. Every
   minute spent should move flags into long-term memory.
4. **Fun.** Streaks, a daily challenge, speed runs, a mastery globe that fills
   up, lookalike duels. Fun comes from feel, rhythm and progress, never from
   noise, ads or nagging.
5. **No account needed.** Progress lives in the browser and can be exported
   and imported as a file. No tracking, no cookies, no ads.
6. **Correct and neutral.** Flags are current, names are respectful, and
   disputed places are explained in a neutral way (7.4).
7. **Works offline** after the first visit (installable PWA).

### 1.4 Out of scope (for now)

Accounts and cloud sync, leaderboards with a server, multiplayer, sub-national
flags, historical flags, ads, analytics that track people. Leave clean seams
for sync and more flag sets, but do not build them.

## 2. Screens

All screens share one top bar: the wordmark `Hoist` on the left; on the right
Daily, Practice, Progress, Flags, and a theme toggle. On phones, the bar
collapses into the wordmark plus a menu button.

### 2.1 Play (the home page, `/`)

Desktop (1440 px), during a round:

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Hoist                          Daily  Practice  Progress  Flags      ◐   │
├────────────────────────────┬─────────────────────────────────────────────┤
│                            │                                             │
│  Europe · 12 due · 🔥 7     │                 .  .   .                    │
│                            │            .  .  ...... .  .                │
│  ┌──────────────────────┐  │          .  .:::::::::::.  .                │
│  │                      │  │        .  .::::::▓▓::::::.  .               │
│  │      (the flag)      │  │        . .::::::▓▓▓★ Bern::: .              │
│  │                      │  │        .  .::::::○ Zürich:.  .              │
│  └──────────────────────┘  │          .  .:::::::::::.  .                │
│                            │            .  .  ...... .  .                │
│  ┌──────────────────────┐  │                 .  .   .                    │
│  │ Switzerland        ⏎ │  │                                             │
│  └──────────────────────┘  │                                             │
│                            │                                             │
│  ✓ Switzerland             │                                             │
│  Capital Bern               │                                            │
│  Largest city Zürich        │                                            │
│  Enter for the next flag   │                                  − ⌖ +      │
└────────────────────────────┴─────────────────────────────────────────────┘
```

Phone (375 px): the globe fills the top 45% of the screen, the flag card sits
below it, the answer field is pinned above the on-screen keyboard (use
`visualViewport` so it never hides behind the keyboard). The result replaces
the flag card's caption. Enter on the keyboard (`enterkeyhint="go"`, then
`"next"`) drives the loop.

Before the first answer of a session, the globe turns slowly on its own. It
stops as soon as the player interacts and resumes after 8 seconds of idle.

### 2.2 First visit

No sign-up, no tutorial wall. The first visit opens straight into a short
**starter round**: ten well-known flags (Japan, Brazil, Canada, Germany, …)
so the first minute is a string of wins. After the round, one sentence offers
the choice: "Learn all 197", or pick a region (Europe, Africa, Asia, Americas,
Oceania). The choice can be changed at any time in Practice.

### 2.3 Daily (`/daily`)

The same ten flags for everyone that day, chosen by a seed from the UTC date
(mix of easy, medium and hard by global difficulty, never repeating within 30
days). One attempt per day. At the end: score, time, and a share text like:

```
Hoist Daily 2026-10-25 · 8/10 · 0:41
🟩🟩🟩🟥🟩🟩🟨🟩🟥🟩
hoist.itsanon.com/daily
```

(🟨 = right with a typo or a hint.) Copy to clipboard, and the Web Share API
on phones. Daily streak counter.

### 2.4 Practice (`/practice`)

Pick what to drill. Each mode is a card with one line of text and a count:

- **Review**: what spaced repetition says is due (the default)
- **Learn new**: introduces 5 new flags at a time (7.2)
- **Region**: Europe, Africa, Asia, North America, South America, Oceania,
  the Caribbean
- **Lookalikes**: drills confusable pairs (7.3)
- **Speed run**: all 197 (or a region) against the clock, with personal bests
- **Reverse**: the globe shows a country, type its name (and optionally pick
  its flag from four)
- **Capitals**: the flag and name are shown, type the capital
- **Easy mode**: pick from four flags or four names. For beginners and small
  children. It counts toward progress with less weight.

### 2.5 Progress (`/progress`)

- **The mastery globe**: every country tinted by how well it is known (four
  steps from untouched to mastered, monochrome with the accent for mastered).
  Drag it around. It should feel like filling in the world.
- Totals: mastered, learning, new; daily streak; best speed runs.
- A calendar strip of the last 12 weeks (squares, like GitHub's).
- "Hardest for you": the five flags with the most lapses, each with a "drill"
  button.
- Export and import progress (`hoist-progress.json`), and reset.

### 2.6 Flags (`/flags` and `/flags/[slug]`)

- `/flags`: a fast grid of all flags, filter by region, search by name,
  sort by name, region or how well you know it. Clicking a flag opens its page.
- `/flags/[slug]` (prerendered, one page per country, good for search
  engines): the large flag, the names, capital, largest city, region,
  population of the largest city, the flag's proportions, its lookalikes with
  links, and a small static globe image showing where it is (an SVG rendered at
  build time, no JavaScript needed). Licence and source of the flag image at
  the bottom.
- `/lookalikes`: every confusable group side by side, with one sentence on
  how to tell them apart (7.3).

### 2.7 About (`/about`)

What Hoist is, how the learning works in five sentences, keyboard shortcuts,
and full credits for every data source with licences (section 8).

## 3. Learning design

### 3.1 Why it works this way (the research)

- **Retrieval practice:** recalling an answer strengthens memory far more than
  re-reading it (Roediger & Karpicke 2006). Typing the name is retrieval.
- **Generation effect:** producing an answer yourself beats recognising it
  (Slamecka & Graf 1978). This is why the main mode is typing, not picking.
- **Spacing:** reviews spread over increasing intervals beat cramming
  (Cepeda et al. 2006). Scheduling uses FSRS (3.2).
- **Interleaving:** mixing similar items, rather than blocking them, helps
  people learn to tell them apart (Kornell & Bjork 2008). This drives the
  lookalike drills.
- **Immediate, specific feedback:** on a miss, show the right answer and what
  was confused, right away.
- **Dual coding:** the globe ties each flag to a place and a shape on the map,
  a second memory cue next to the colours.

### 3.2 Scheduling with FSRS

Use `ts-fsrs` (5.4.2, MIT) with the default parameters and a desired retention
of 0.9. Each country has one card per mode that schedules (flag → name is the
main card; capital and reverse cards are separate and optional).

Grading from one answer:

| What happened | FSRS rating |
|---|---|
| Wrong, gave up (Esc), or picked the wrong one in easy mode | Again |
| Right after a hint, or with a typo that was accepted (5.3) | Hard |
| Right | Good |
| Right, no typo, and answered in under 4 seconds from when the flag appeared | Easy |

The session queue:
1. Due cards first, most overdue first, at most 50 per session.
2. Then new cards, at most 10 per day by default (setting: 5, 10, 20, 30).
3. Never show the same flag twice in a row. Interleave by region and colour so
   two near-identical flags rarely appear back to back, except in the
   lookalike mode where that is the point.
4. A card answered Again comes back within the same session after 3 to 6 other
   cards, until answered right once.

Keep all FSRS state in the progress store (3.4). Write unit tests for the
grading and queue rules.

### 3.3 Hints and giving up

- **Tab** reveals the next letter of the answer (one letter per press, at most
  half the name). Any hint caps the rating at Hard.
- **Esc** gives up: the answer is revealed on the globe, rated Again.
- **?** (or the help icon) shows the keyboard shortcuts.

### 3.4 The progress store

- Stored in `localStorage` under one versioned key (`hoist:v1`), as one JSON
  object: settings, cards (FSRS state per card id), daily results, streaks, best
  times. Under 200 KB for all 197 countries in all modes.
- Every read and write is wrapped in try/catch. If storage is unavailable
  (private mode, blocked), the app still works for the session and shows one
  quiet line: "Progress won't be saved in this browser."
- Schema migrations are written as pure functions with tests.
- Export and import as a JSON file. Import validates the schema and merges by
  most recent review.
- Keep a clean `ProgressStore` interface so a cloud sync could be added later.

## 4. The globe (most of the "wow")

### 4.1 The look

A glass globe floating on the page background:

- **Body:** a radial gradient, slightly brighter toward the upper left (a soft
  light source), at low opacity, so the page background shows through.
- **Far side:** the land on the back of the globe is drawn very faintly, seen
  through the glass. This is what makes it feel semi-transparent and
  three-dimensional. Fade it out as the view zooms in (at zoom 2 and beyond it
  is gone), otherwise it reads as large shadows.
- **Land, front side:** a field of fine dots (like the globe on Vercel's and
  GitHub's sites), brighter in the middle of the visible disc and fading toward
  the edge. At zoom 2 and beyond, cross-fade from dots to solid land with
  hairline country borders, because dots get too sparse up close.
- **Graticule:** a 10° grid at very low opacity.
- **Rim:** a 1 px rim light, plus a soft outer halo (a radial gradient from
  1.0 to 1.08 times the radius) that fades into the background.
- **Target country:** filled with the accent colour at about 28% opacity, with
  a crisp 1.25 px accent outline. Its shape also shows faintly through the
  glass when it is on the far side during the flight.
- **Markers:** capital = 4 px solid dot with a 2 px ring in the background
  colour, plus a ring that pulses outward twice and then stops (an endless
  pulse is noisy). Largest city = 2.5 px hollow dot. Labels in Geist 12 px with
  a 3 px halo in the background colour so they stay readable over land. If the
  two labels would overlap (closer than 24 px), place them on opposite sides.
- **Tiny countries** (Monaco, Vatican City, Nauru, Tuvalu, …): when the target
  is smaller than about 20 px across on screen, draw a 14 px accent ring
  around it, so it is never lost.
- Light mode is the same idea in black ink on white; dark mode is white ink on
  black. Both must look deliberate, not inverted.

### 4.2 Motion

- **Fly to a country:** the view centre moves along the great circle
  (`d3.geoInterpolate`) while the zoom dips out a little in the middle of long
  flights and comes back in at the end, so the player sees where the country
  is on the planet. Duration 700 ms for neighbours up to 1,400 ms across the
  world. Easing: cubic in-out.
- **One camera, always interruptible:** a new flight cancels the one in
  progress and starts from the current position. Drag and zoom also cancel it.
  (A prototype of this globe had two flights running at once when the player
  answered quickly, and the view ended up between countries.)
- **Framing:** the target view (centre and zoom) is precomputed per country at
  build time from its **main landmass**, not the centroid of all its parts.
  The centroid of all of France's polygons lies in the Atlantic (about −6.7°,
  43°) because of its overseas regions, and the United States' bounding box
  crosses the antimeridian. Allow manual overrides in the data (8.4).
- **Zoom limits:** 0.9× to 4×. The whole globe edge stays visible up to 2.5×,
  so it always feels like a globe. Tiny countries get the ring (4.1) instead of
  more zoom.
- **Drag** rotates the globe so the point under the finger stays under the
  finger (use `versor`, 0.2.0), with gentle inertia after release
  (`d3-inertia`, 0.4.0, or a small hand-written version). Pinch and wheel zoom
  toward the pointer. Double-click zooms in one step.
- **Reduced motion** (`prefers-reduced-motion: reduce`): no auto-rotation, no
  pulse; a flight becomes a 150 ms cross-fade to the final view.
- **Idle:** auto-rotation at about 3°/s before the first answer. Stop drawing
  frames when nothing moves (no animation, no pulse, no drag), so a laptop
  stays cool.

### 4.3 How to build it

Render with **Canvas 2D and `d3-geo`** (3.1.1). This was prototyped while
researching this brief, and it works and looks right:

- Use `geoOrthographic` with `clipAngle(90)` for the front side.
- For the far side, use a second orthographic projection rotated by
  `[λ + 180, −φ, −γ]` with `reflectX(true)`. This was checked numerically
  against the unclipped orthographic formula and matches exactly, so far-side
  shapes land where they would be seen through the glass.
- Canvas is sized to the element times `devicePixelRatio`, capped at 2.
- Draw order: halo, body, far-side land, far-side target, graticule, land
  (dots or solid), borders, target fill and outline, tiny-country ring,
  markers, labels, rim.
- **Land dots are precomputed at build time** (8.5) and shipped as a small
  binary file. Do not test points against land polygons in the browser: in the
  prototype, testing 16,000 points against the 1:50m land shape froze the page
  for seconds.
- Use the overview geometry (8.5) while moving or zoomed out, and swap in the
  detailed geometry, loaded lazily, when the view is at rest and zoomed past
  1.8×.
- For the dot field, skip dots on the far side with a cheap dot-product test
  against the view centre before projecting; draw the remaining dots with
  `fillRect`. If a phone cannot hold 60 fps, draw the dot layer into an
  offscreen canvas only when the rotation changes by more than 0.2°.
- Wrap it all in one `Globe` class with a small API: `flyTo(countryId)`,
  `showMarkers(...)`, `setMastery(map)`, `setTheme()`, `resize()`,
  `destroy()`, and a Svelte component around it. No globe code inside page
  components.
- Only if Canvas 2D cannot meet the budgets in section 10 on a mid-range
  phone, move the dot layer (not the whole globe) to WebGL2 with one
  instanced draw call. Record the measurement in `docs/decisions.md` first.

Do not use three.js, globe.gl, MapLibre or cobe. They are heavier than
needed or cannot draw the highlighted country shape, and the canvas approach
gives full control over the look.

### 4.4 Static globe images

For `/flags/[slug]` and social preview images, render the same look (dots,
highlighted country, capital marker) as an SVG at build time with `d3-geo`
in Node, in light and dark versions. Also render a 1200×630 PNG Open Graph
image per country (flag plus small globe) with `@resvg/resvg-js` (2.6.2).

## 5. Checking answers

The goal: accept every answer a fair judge would accept, reject every answer
that names a different country, and never make the player feel cheated.

### 5.1 Normalising

Lowercase; remove accents (`normalize('NFD')` and strip combining marks);
`&` → `and`; `st.`/`st` → `saint`; remove `the`, punctuation, apostrophes,
hyphens and spaces. So `Côte d'Ivoire`, `cote divoire` and `Cote D'Ivoire`
are the same.

### 5.2 Names that count as right

Per country: the common English name, the official name, the aliases in the
data (`altSpellings` minus codes), plus a curated list of former and informal
names. Examples that must work:

| Country | Also accepted |
|---|---|
| Türkiye | Turkey, Turkiye |
| Czechia | Czech Republic |
| Eswatini | Swaziland |
| Myanmar | Burma |
| Côte d'Ivoire | Ivory Coast |
| Cabo Verde | Cape Verde |
| Timor-Leste | East Timor |
| North Macedonia | Macedonia |
| United Kingdom | UK, Great Britain, Britain |
| United States | USA, US, America, United States of America |
| United Arab Emirates | UAE, Emirates |
| Vatican City | Holy See, Vatican |
| Bosnia and Herzegovina | Bosnia |
| Democratic Republic of the Congo | DR Congo, DRC, Congo-Kinshasa |
| Republic of the Congo | Congo-Brazzaville |
| Brazil | Brasil |

**Other languages:** the data has translations in 24 languages. A setting
"Also accept names in: …" lets the player add one or more of them (for
example German, French, Italian). Off by default, English always accepted.

### 5.3 Typos

- Compare the normalised answer with every accepted name of every country
  using Damerau–Levenshtein distance.
- Allow distance 1 for names of 5 to 8 letters, 2 for 9 letters or more, 0 for
  shorter names.
- **But** if the answer is equal to, or closer to, a name of a *different*
  country, it is that country, and it is wrong. Must-pass cases: `Niger` ≠
  `Nigeria`, `Dominica` ≠ `Dominican Republic`, `Austria` ≠ `Australia`,
  `Iran` ≠ `Iraq`, `Mali` ≠ `Malawi`, `Slovenia` ≠ `Slovakia`, `Guinea` ≠
  `Guinea-Bissau` ≠ `Equatorial Guinea` ≠ `Papua New Guinea`, `Sudan` ≠
  `South Sudan`, `Korea` alone is ambiguous.
- An accepted typo shows a quiet "Spelling: Philippines" under the result and
  is rated Hard.
- **Ambiguous answers** (`Congo`, `Korea`, `Guinea` when the flag is one of the
  Guineas): don't mark wrong. Show two or three chips ("Which one?") that can
  be picked with the number keys, and grade the pick.
- Write a table-driven test file with at least 150 cases covering all of the
  above.

### 5.4 Autocomplete

Off in the learning modes (it would turn recall into recognition). In Easy
mode and on `/flags` search, show suggestions.

## 6. Design system

### 6.1 Tokens

Copy these tokens exactly (they match the owner's other projects):

```css
:root {
  --bg: #ffffff;
  --fg: #000000;
  --muted: #666666;
  --border: #eaeaea;
  --border-strong: #c9c9c9;
  --surface: #fafafa;
  --danger: #ee0000;
  --accent: #0070f3;
  --overlay: rgba(0, 0, 0, 0.12);
  --sans: 'Geist', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
  --mono: 'Geist Mono', ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;
  --t13: 13px; --t14: 14px; --t16: 16px; --t24: 24px; --t40: 40px;
  --r-sheet: 8px;
  --r-btn: 6px;
  --ease: cubic-bezier(0.16, 1, 0.3, 1);
  color-scheme: light;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
    --bg: #000000; --fg: #ffffff; --muted: #a1a1a1; --border: #333333;
    --border-strong: #4d4d4d; --surface: #0a0a0a; --accent: #3291ff;
    --overlay: rgba(0, 0, 0, 0.6);
    color-scheme: dark;
  }
}

:root[data-theme='dark'] {
  --bg: #000000; --fg: #ffffff; --muted: #a1a1a1; --border: #333333;
  --border-strong: #4d4d4d; --surface: #0a0a0a; --accent: #3291ff;
  --overlay: rgba(0, 0, 0, 0.6);
  color-scheme: dark;
}
```

Fonts: Geist and Geist Mono, self-hosted variable WOFF2 from the `geist`
package (1.8.2, OFL), `font-display: swap`, preload the sans file only.
Numbers use `font-variant-numeric: tabular-nums`.

### 6.2 Rules

- **Colour:** only flags are colourful. The accent (`--accent`) is used for the
  globe highlight, mastered countries on the mastery globe, and focus rings.
  Right answers use the foreground with a ✓; wrong answers use `--danger` with
  a ✗. Never rely on colour alone.
- **Flags:** shown at their true proportions (Nepal is not a rectangle, Qatar
  is 11:28, Switzerland and Vatican City are square), inside a card with a
  1 px hairline around the flag itself so white flags read on white. Never
  crop, never round the flag's corners more than 2 px, never add a gradient.
- **Type:** 40 px for the result name on desktop, 24 px on phones; 14 px body;
  13 px meta in `--muted`. Tight letter spacing on large sizes (−0.02em).
- **Motion:** UI transitions 120 to 200 ms with `--ease`. The result text rises
  4 px and fades in. A wrong answer gives the input one short horizontal shake
  (6 px, 2 cycles). A streak milestone (10 in a row) gives the flag card one
  soft glow in the accent colour. No confetti, no bouncing.
- **Sound:** optional, off by default. One soft tick for right, one low tone
  for wrong, synthesised with the Web Audio API (no audio files).
- **Haptics:** on phones that support it, a 10 ms vibration on a right answer
  (setting, on by default).
- Layout grid of 8 px. Cards: 1 px `--border`, 8 px radius, no shadows except
  the flag hairline.

## 7. Content rules

### 7.1 Which countries

The default set is **197**: the 193 UN member states, the two UN observer
states (Vatican City, Palestine), Kosovo and Taiwan. Show the count and this
definition on `/about`.

An optional pack, off by default, adds widely-seen territories with their
own flags (Greenland, Puerto Rico, Hong Kong, Macau, Faroe Islands, Bermuda,
…). Keep it as data only; the UI only needs a toggle in settings.

### 7.2 Learn new

New flags are introduced five at a time: each is shown with its name, globe
flight and capital first ("study card"), then all five are quizzed in mixed
order straight away, then they join the review queue. Introduce in an order
that helps: well-known first, and never two members of the same lookalike
group in the same batch.

### 7.3 Lookalikes

A curated list of confusable groups, each with one short sentence on how to
tell them apart. Start with at least these and check each against the actual
flags:

- Chad / Romania (Chad's blue is darker), also Andorra and Moldova (coats of
  arms)
- Indonesia / Monaco (Monaco is squarer, 4:5) / Poland (white on top)
- Ireland / Côte d'Ivoire (green at the hoist for Ireland) / Italy
- Netherlands / Luxembourg (lighter blue) / Russia / Croatia
- Norway / Iceland (colours swapped) / Denmark / Finland / Sweden
- Australia / New Zealand (red stars, no Commonwealth Star for New Zealand)
- Slovenia / Slovakia / Russia
- Senegal / Mali / Guinea / Cameroon
- Colombia / Ecuador / Venezuela
- El Salvador / Nicaragua / Honduras
- Jordan / Palestine / Sudan (Jordan's has a white star)
- United Arab Emirates / Kuwait
- Egypt / Iraq / Yemen / Syria (Syria changed its flag in 2025, see 8.2)
- Qatar / Bahrain
- Niger / India
- Liberia / United States / Malaysia
- Haiti / Liechtenstein
- Austria / Latvia / Lebanon
- Belgium / Germany (same colours, different direction and order)
- Hungary / Italy / Tajikistan / Bulgaria
- Ghana / Bolivia / Guinea-Bissau

Also compute candidates automatically at build time (8.6) and list them in a
report for review, so no strong lookalike is missed. Only curated groups ship.

### 7.4 Neutral wording for disputed cases

- Use the name the country uses for itself in English (Türkiye, Czechia,
  Eswatini, Myanmar, Côte d'Ivoire, Cabo Verde, Timor-Leste), with the other
  names accepted (5.2).
- Where the capital is disputed or split, show the country's own designation
  and add a short neutral note:
  - Israel: Jerusalem, with the note "Status disputed; most embassies are in
    Tel Aviv."
  - Palestine: Ramallah, with the note "Seat of government; East Jerusalem is
    the proclaimed capital."
  - Bolivia: Sucre (constitutional) and La Paz (seat of government); accept
    either in the capitals mode.
  - South Africa: Pretoria (executive), Cape Town (legislative), Bloemfontein
    (judicial); accept any.
  - Netherlands: Amsterdam (capital), The Hague (seat of government).
  - Eswatini: Mbabane (administrative) and Lobamba (legislative). The data
    lists Lobamba only and GeoNames marks Mbabane; show both.
  - Malaysia: Kuala Lumpur, with Putrajaya as the administrative centre.
  - Côte d'Ivoire: Yamoussoukro, with Abidjan as the economic capital (and
    largest city).
  - Benin: Porto-Novo, with Cotonou as the seat of government.
  - Indonesia: Jakarta. Nusantara is under construction and planned to
    replace it; switch only when the move is official and complete. Keep this
    in `data/overrides.json` with a note and a date.
- Taiwan is shown as "Taiwan", Kosovo as "Kosovo", Palestine as "Palestine".
  No political statements anywhere.

## 8. Data pipeline

All data is built by scripts in `scripts/data/` (TypeScript, run with Node),
written to `src/lib/data/` and `static/`, and **committed** to the repo, so
the site build never depends on the network. A `pnpm data` command re-runs the
whole pipeline. Raw downloads go to `data/raw/` (git-ignored).

### 8.1 Countries: names, regions, aliases

- Source: `mledoze/countries` (release 5.1.0, ODbL-1.0): 250 entries with
  `cca2`, `cca3`, `ccn3`, common and official names, native names,
  `altSpellings`, translations in 24 languages, region and subregion, area,
  `unMember`, `independent`, capital names (no coordinates).
- Known quirks found during research:
  - It marks Vatican City as a UN member (`unMember: true`), so it counts 194
    UN members. Vatican City is an observer; select the 197 by an explicit
    list in `data/set-197.json`, not by the flag.
  - Only two entries list several capitals (Bonaire, South Africa). Split
    capitals elsewhere come from overrides (7.4).
- ODbL requires attribution and that the derived database stays under ODbL.
  Keep the generated `countries.json` under ODbL and say so in `/about` and in
  `data/LICENSE-DATA.md`. The code stays MIT.

### 8.2 Flags

- **Source: Wikimedia Commons**, file `Flag of <Country>.svg`, the files used
  in Wikipedia's infoboxes. Almost all are public domain. They have true
  proportions and are kept up to date.
- **Do not use `flag-icons` or `region-flags` as the source.** Checked during
  research: `flag-icons` (7.6.0) crops every flag to 4:3 and 1:1, and both
  sets still had **Syria's old flag**. Syria adopted a new flag (green, white,
  black with three red stars) in 2025, and Commons has had it since
  2025-01-21 (`Flag of Syria.svg` now points to `Flag of Syria (2025-).svg`).
- Fetch with the MediaWiki API:
  `https://commons.wikimedia.org/w/api.php?action=query&titles=File:Flag_of_Japan.svg&prop=imageinfo&iiprop=url|size|sha1|timestamp|extmetadata&iiextmetadatafilter=LicenseShortName|Artist|Credit&format=json`
  Follow redirects (`&redirects=1`). Send a descriptive `User-Agent` with a
  contact URL, as Wikimedia's policy asks. Throttle to one request per second.
- Map country → Commons file title in `data/flag-sources.json` (some titles
  differ, for example `Flag of the United States.svg`, `Flag of the People's
  Republic of China.svg`). Fail the build if any of the 197 is missing.
- Optimise each SVG with `svgo` (4.1.0), keeping the `viewBox`. Record in
  `src/lib/data/flags.json`: file, width/height ratio from the `viewBox`,
  licence, author, Commons URL, Commons revision timestamp, SHA-1.
- Size budget: 30 KB per flag after SVGO. Flags with detailed coats of arms
  (Spain, Mexico, Ecuador, …) may exceed it; for those, also produce a 960 px
  WebP with `sharp` (0.35.5) and use it in the quiz, keeping the SVG for the
  flag page. Report the total size; the whole set should stay under 2 MB.
- Output file names are content hashes (`/flags/3f9a1c.svg`), **not country
  codes**, so the answer is not visible in the image URL. The quiz image's
  `alt` is "Flag to name" until answered, then "Flag of Japan".
- **Staying current:** a scheduled GitHub Action runs weekly, re-checks every
  Commons file's SHA-1, and opens a pull request with the changed flags and a
  side-by-side preview. It never commits to `main` on its own.

### 8.3 Capitals and largest cities

- Source: **GeoNames** `cities1000` (CC BY 4.0; the dump was dated
  2026-10-24 during research). Fields used: name, ASCII name, latitude,
  longitude, feature code, country code, population.
- **Capital:** the city with feature code `PPLC` in the country, matched
  against the capital name from 8.1. During research, 9 of 250 entries had no
  `PPLC` (`AQ BV EH HM IO IL PS TK UM`; only Israel and Palestine matter for
  the 197) and 15 names differed in spelling (`Washington D.C.` vs
  `Washington`, `Chișinău` vs `Chisinau`, `Nay Pyi Taw` vs `Naypyidaw`,
  `Sanaa` vs `Sana'a`, `Mbabane` vs `Lobamba`, …). Use the GeoNames
  coordinates, the data's display name, and overrides for the rest.
- **Largest city:** the most populous place in the country, excluding
  abandoned or historical places (`PPLX`, `PPLH`, `PPLQ`, `PPLW`) and
  sections of cities. GeoNames populations are city proper and sometimes
  outdated. Research found Rotterdam (868,135) ahead of Amsterdam (741,636),
  which is wrong today. So:
  - the build writes `reports/largest-city.md` listing every country where the
    top two cities are within 25% of each other, for manual review
  - `data/overrides.json` fixes them, each with a source URL and a date.
- Spot checks that must pass: China → Shanghai, India → Mumbai, Türkiye →
  Istanbul, Australia → Sydney, Canada → Toronto, Brazil → São Paulo,
  Nigeria → Lagos, Pakistan → Karachi (GeoNames says Lahore; check and override
  with a source), Vietnam → Ho Chi Minh City, Tanzania → Dar es Salaam,
  Kazakhstan → Almaty, Morocco → Casablanca, Côte d'Ivoire → Abidjan,
  Switzerland → Zürich, New Zealand → Auckland, United States → New York City.
- Credit GeoNames on `/about` (CC BY 4.0 requires it).

### 8.4 Overrides

`data/overrides.json`, keyed by `cca2`: display name, extra aliases, capital
(name, coordinates, note), largest city, view (centre, zoom), and a `source`
and `checked` date for every changed field. The build fails if an override
has no source.

### 8.5 Geometry

- Source: **Natural Earth 5.1.2** (released 2022-05-13, public domain),
  `ne_10m_admin_0_countries`. Join on `ISO_A2_EH` (Natural Earth's ISO field
  that also covers France and Norway, which have `-99` in plain `ISO_A2`),
  with `ADM0_A3` as the fallback (Kosovo has no ISO code).
- **Do not use `world-atlas`** (2.0.2). It is built from the older Natural
  Earth 4.1.0. Checked during research: its 1:110m file lacks 30 of the 197
  countries (all the small island states, Singapore, Bahrain, Malta,
  Monaco, …), and its 1:50m file lacks Tuvalu and has no ISO code for Kosovo.
- Natural Earth also ships "point of view" editions
  (`ne_10m_admin_0_countries_<iso3>`). Use the default edition.
- Build with `mapshaper` (0.7.98) into two TopoJSON files:
  - `overview.topo.json`: simplified for the whole globe (target ≤ 120 KB
    gzipped), keeping every one of the 197 with at least a small polygon.
  - `detail.topo.json`: finer (target ≤ 600 KB gzipped), loaded lazily.
  - Both with quantisation, properties stripped down to `id` (cca2).
- `land-dots.bin`: points on a Fibonacci sphere lattice (about 20,000 on the
  sphere) kept if they are on land, stored as Int16 pairs (longitude ×
  100, latitude × 100). Target ≤ 60 KB.
- Per country, precompute and store in `countries.json`: the view centre
  (from the largest polygon, or the polygon that holds the capital), a zoom
  that fits that polygon with margin, and `tiny: true` when it is under a size
  threshold.

### 8.6 Lookalike candidates

At build time, rasterise each flag to 64×40 (ignoring true proportions for this
step), convert to Lab colour, and compute a distance from colour histograms plus
a coarse layout. Write the 60 closest pairs, and any pair closer than the
curated groups' widest member, to `reports/lookalikes.md`. Humans decide
what goes into `data/lookalikes.json`.

### 8.7 Audits (the build fails if any fails)

- All 197 have: names, a flag file, a capital with coordinates, a largest city
  with coordinates, a region, a view, a polygon in both geometry files.
- The capital and largest city lie inside the country's polygon, or within
  25 km of it (for coastal cities on simplified coastlines).
- The view centre is inside the country's polygon.
- No two countries share a normalised accepted name, except the known
  ambiguous ones in a whitelist (Congo, Korea, Guinea).
- Every flag is under its size budget or has a WebP fallback.
- Every override has a source and date.

Write `reports/data-summary.md` on every run: counts, sizes, warnings.

## 9. Technical stack

| Part | Choice | Version (checked 2026-10-25) |
|---|---|---|
| Framework | SvelteKit with Svelte 5 runes | `@sveltejs/kit` 3.1.0, `svelte` 5.57.2 |
| Build | Vite | 8.3.5 |
| Output | Fully static, prerendered | `@sveltejs/adapter-static` 4.0.0 |
| Language | TypeScript, strict | **6.0.3** (see note) |
| Type checks | svelte-check | 4.7.7 |
| Globe | Canvas 2D + d3-geo + topojson-client | 3.1.1, 3.1.0 |
| Globe drag | versor, d3-inertia | 0.2.0, 0.4.0 |
| Scheduling | ts-fsrs | 5.4.2 |
| Offline | `@vite-pwa/sveltekit` | 1.1.0 |
| Fonts | `geist` | 1.8.2 |
| Data build | mapshaper, svgo, sharp, @resvg/resvg-js | 0.7.98, 4.1.0, 0.35.5, 2.6.2 |
| Unit tests | Vitest | 5.0.5 |
| End-to-end | Playwright | 1.64.1 |
| Hosting | Cloudflare Workers static assets | wrangler 4.152.0 |
| Package manager | pnpm | 10.x, pinned in `packageManager` |

**TypeScript note:** TypeScript 7.0.2 is out, but `svelte-check` 4.7 refuses to
run on TypeScript 7 alone (it needs TypeScript 6 installed next to it plus the
`--tsgo` flag). Use 6.0.3 and add a Dependabot rule that ignores TypeScript
major updates until `svelte-check` supports 7 directly.

No UI component library, no CSS framework, no state library. Plain CSS with
the tokens, Svelte components, and `$state`/`$derived` runes.

## 10. Performance budgets

Measure each in CI or with a script, and fail the milestone if missed:

| What | Budget |
|---|---|
| JavaScript on the play page, gzipped, initial | ≤ 75 KB |
| Overview geometry + land dots, gzipped | ≤ 180 KB |
| Largest Contentful Paint, mid phone on 4G (Lighthouse mobile) | ≤ 1.5 s |
| Cumulative Layout Shift | 0 |
| Lighthouse Performance, Accessibility, Best Practices, SEO | 100, 100, 100, 100 |
| Globe frame time during a flight, mid laptop | ≤ 6 ms |
| Globe frame time during a flight, 4× CPU throttle | ≤ 14 ms |
| Time from Enter to the globe starting to move | ≤ 50 ms |
| The first flag visible | in the initial HTML, no JavaScript needed |

Tactics: prerender the play page with the first flag of the starter round in
the HTML; load the globe module after first paint; preload the overview
geometry; hash and cache everything immutable for a year; `Cache-Control:
no-cache` on HTML.

## 11. Accessibility

- Every action works by keyboard alone (Enter, Tab for hint, Esc to give up,
  number keys for chips, arrow keys rotate the globe when it is focused, +/−
  zoom).
- Visible focus ring on everything (2 px `--fg` outline, 2 px offset).
- The result is announced in an `aria-live="polite"` region ("Right.
  Switzerland. Capital Bern. Largest city Zürich.").
- The globe canvas is `role="img"` with a label describing the current view
  ("Globe showing Switzerland in Europe"). All information on the globe is
  also in the text.
- Contrast AA everywhere, including muted text in both themes.
- Respect `prefers-reduced-motion` (4.2) and `prefers-color-scheme`, with a
  manual theme toggle stored in the progress store.
- Text can be zoomed to 200% without breaking the layout.

## 12. Repository layout

```
hoist/
  CLAUDE.md                 how to work on the code
  PROMPT.md                 this brief
  README.md
  LICENSE                   MIT (code)
  data/                     curated inputs: set-197, flag-sources, overrides,
    LICENSE-DATA.md           aliases, lookalikes; data licences
    raw/                    downloads (git-ignored)
  scripts/data/             the pipeline (section 8)
  reports/                  generated review reports (committed)
  src/
    lib/
      data/                 generated: countries.json, flags.json
      globe/                Globe class, layers, camera, interaction
      learn/                FSRS wrapper, queue, grading
      match/                normalising and answer matching
      store/                progress store and migrations
      ui/                   small components (Button, Card, FlagCard, ...)
    routes/                 /, /daily, /practice, /progress, /flags, /about
  static/
    flags/                  hashed SVG and WebP files
    geo/                    overview.topo.json, detail.topo.json, land-dots.bin
  tests/                    Vitest units
  e2e/                      Playwright tests
  docs/
    plan.md  decisions.md  research.md
  .github/
    workflows/ci.yml  flags-update.yml
    dependabot.yml
```

## 13. Testing and CI

- **Unit (Vitest):** answer matching (150+ cases, 5.3), FSRS grading and
  queue, daily seed (same ten for the same date, no repeats within 30 days),
  store migrations, import/export, geometry helpers (view centre inside
  polygon).
- **Data audits** (8.7) run in CI on the committed data.
- **End-to-end (Playwright):** a full starter round by keyboard only; a wrong
  answer then a right one; the "Which Congo?" chips; a typo accepted as Hard;
  the daily round and share text; export then import; offline after first
  load; reduced motion; light and dark; 375 px and 1440 px.
- **Visual:** Playwright screenshots of the play page (before and after an
  answer), progress, flags grid and one flag page, in both themes, stored as
  artifacts for review. Use a fixed seed and a fixed globe rotation so
  screenshots are stable.
- **Performance:** a Playwright test records frame times during five flights
  with 4× CPU throttling and fails over budget (section 10). Lighthouse CI on
  the play page and one flag page.
- **CI** (`.github/workflows/ci.yml`): install, svelte-check, Vitest, data
  audits, build, Playwright, Lighthouse, bundle-size check. Dependabot weekly
  for npm and GitHub Actions, grouped, with the TypeScript major-version
  ignore rule (section 9).

## 14. Milestones

Each milestone: build, test, look at it in the browser, update `docs/plan.md`,
commit, push.

### M0: Foundation
SvelteKit with the static adapter, TypeScript strict, the tokens and fonts,
the top bar and empty routes, light/dark/system theme, CI, Dependabot,
`CLAUDE.md`, deploy to Cloudflare (`wrangler.jsonc` with static assets from
`build/`).
**Done when:** CI is green, the empty site is deployed, Lighthouse 100s on the
empty play page.

### M1: Data pipeline
Sections 8.1 to 8.7: countries, flags from Commons with SVGO, capitals and
largest cities with overrides, geometry, land dots, views, audits, reports.
**Done when:** `pnpm data` runs from scratch, all audits pass for all 197, the
spot checks in 8.3 pass, Syria has the 2025 flag, Nepal's flag is not a
rectangle, and `reports/` is reviewed and committed.

### M2: The globe
Section 4: the look, both themes, fly-to, markers, tiny-country rings,
drag/zoom/inertia, reduced motion, overview and detail geometry, static SVG
globes for flag pages.
**Done when:** flying Japan → Brazil → Monaco → New Zealand → France looks
right in screenshots (France framed on the mainland, Monaco ringed, labels not
overlapping), and the frame-time budgets pass.

### M3: The core loop
Section 1.2 and 5: flag card, answer field, matching, result, globe reveal,
hints, give up, ambiguous chips, keyboard loop, phone layout with the keyboard
open, the starter round for first visits.
**Done when:** a full round works by keyboard alone and on a 375 px phone
emulation with the on-screen keyboard; the 150 matching cases pass.

### M4: Learning engine
Section 3: FSRS, queue rules, Learn new, Review, Region, Capitals, Reverse,
Easy mode, the progress store with export/import.
**Done when:** a simulated month of daily sessions in a unit test gives
sensible intervals; reloading keeps progress; import of an export restores it
exactly.

### M5: Fun
Daily challenge with share, streaks, speed run with personal bests, the
mastery globe on `/progress`, lookalike drills, the streak glow, optional
sound and haptics.
**Done when:** the daily set is identical across two browsers on the same date,
the share text is right, the mastery globe fills in as cards are learned.

### M6: Pages, offline, languages
`/flags` grid, 197 prerendered flag pages with static globes and Open Graph
images, `/lookalikes`, `/about` with all credits, PWA offline and install,
"Also accept names in" setting, sitemap and robots.
**Done when:** the site works offline after one visit, every flag page has a
valid OG image, credits list every source and licence.

### M7: Polish and launch
Accessibility pass (section 11), performance pass (section 10), copy pass
(short, friendly, no jargon), visual pass in both themes at four widths, error
states (storage blocked, geometry failed to load: the quiz still works, with
the text answer only), a 404 page, the weekly flag-update workflow.
**Done when:** all budgets and Lighthouse 100s pass, all e2e tests pass,
screenshots reviewed, the README has screenshots, and the owner can run
`pnpm data`, `pnpm dev`, `pnpm test`, `pnpm build` from the README.

## 15. Don'ts

- No runtime calls to third-party services, no tracking, no cookies, no ads.
- No third-party globe or map library (4.3).
- No flag sets that crop or are out of date (8.2).
- No multiple choice in the main mode.
- No endless animations, confetti, or sound by default.
- No answer leaks: not in image URLs, `alt` text, page title, or the DOM
  before the answer is given.
- Never commit secrets. The Cloudflare deploy uses the dashboard's Git
  integration or a repository secret.
- Do not change this brief's product decisions without writing why in
  `docs/decisions.md`.

## 16. Open points for the owner

Build with the defaults below; the owner can change them later.

1. **Domain:** default `hoist.itsanon.com`.
2. **Repository visibility:** private for now; flip to public at launch.
3. **Optional territories pack:** built as data, off by default.
4. **Name:** "Hoist" is a working name; keep it in one constant
   (`src/lib/brand.ts`) so it is easy to change.
