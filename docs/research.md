# Research notes

Checked on 2026-10-25 while writing [PROMPT.md](../PROMPT.md). These are the
facts the brief relies on, with how each was checked, so the build session does
not have to repeat them.

## Packages

From `npm view <pkg> version` and `license`:

| Package | Version | Licence | Use |
|---|---|---|---|
| svelte | 5.57.2 | MIT | UI |
| @sveltejs/kit | 3.1.0 | MIT | framework |
| @sveltejs/adapter-static | 4.0.0 | MIT | static output |
| vite | 8.3.5 | MIT | build |
| typescript | 7.0.2 latest, **use 6.0.3** | Apache-2.0 | types |
| svelte-check | 4.7.7 | MIT | type checks |
| d3-geo | 3.1.1 | ISC | projections |
| topojson-client | 3.1.0 | ISC | geometry decode |
| versor | 0.2.0 | ISC | globe drag |
| d3-inertia | 0.4.0 | MIT | drag inertia |
| ts-fsrs | 5.4.2 | MIT | spaced repetition |
| @vite-pwa/sveltekit | 1.1.0 | MIT | offline |
| geist | 1.8.2 | OFL-1.1 | fonts |
| mapshaper | 0.7.98 | MPL-2.0 | geometry build |
| svgo | 4.1.0 | MIT | flag optimising |
| sharp | 0.35.5 | Apache-2.0 | WebP fallbacks, lookalike rasters |
| @resvg/resvg-js | 2.6.2 | MPL-2.0 | OG images |
| vitest | 5.0.5 | MIT | unit tests |
| @playwright/test | 1.64.1 | Apache-2.0 | e2e |
| wrangler | 4.152.0 | MIT or Apache-2.0 | deploy |

Considered and not used: `three` 0.186.1, `globe.gl` 2.46.2, `maplibre-gl`
6.15.0, `cobe` 2.0.1 (heavier, or cannot draw a highlighted country shape),
`world-atlas` 2.0.2, `flag-icons` 7.6.0 (see below).

**TypeScript 7 and svelte-check:** in the owner's Spool project, Dependabot's
bump to TypeScript 7.0.2 failed CI with svelte-check 4.7.6: "TypeScript 7
support currently requires both TypeScript 7 and TypeScript 6 installed in your
project, and requires using the --tsgo or --tsgo-experimental-api flag." Hence
TypeScript 6.0.3.

## Country data: mledoze/countries

- Release 5.1.0, ODbL-1.0, last push 2026-10-22, `countries.json` 1.3 MB,
  250 entries.
- Fields: `altSpellings area borders capital cca2 cca3 ccn3 cioc currencies
  demonyms flag idd independent landlocked languages latlng name region status
  subregion tld translations unMember unRegionalGroup`.
- Translations in 24 languages: ara bre ces deu est fin fra hrv hun ita jpn kor
  nld per pol por rus slk spa srp swe tur urd zho.
- `unMember: true` on 194 entries, including Vatican City (an observer, not a
  member). Select the 197 by an explicit list.
- Only Bonaire and South Africa list several capitals. Eswatini lists Lobamba
  only. No capital coordinates.
- Common names it uses: Türkiye, Czechia, North Macedonia, Eswatini, Myanmar,
  "Ivory Coast" (common) with "Côte d'Ivoire" in `altSpellings`, "Cape Verde"
  (common) with official "Republic of Cabo Verde".

## Cities: GeoNames

- `cities1000.zip` (10.6 MB, 171,590 places) and `cities15000.zip` (3.2 MB,
  34,180 places), Last-Modified 2026-10-24, CC BY 4.0.
- Capital via feature code `PPLC`: 9 of 250 entries have none (`AQ BV EH HM IO
  IL PS TK UM`). 15 differ in spelling from mledoze's capital names, for example
  `Washington D.C.`/`Washington`, `Chișinău`/`Chisinau`,
  `Naypyidaw`/`Nay Pyi Taw`, `Sana'a`/`Sanaa`, `Lobamba`/`Mbabane`,
  `City of Victoria`/`Hong Kong`.
- Largest place by GeoNames population, examples: CN Shanghai 24.9 M, US New
  York City 8.8 M, IN Mumbai 12.7 M, BR São Paulo 12.4 M, TR Istanbul 15.7 M,
  AU Sydney 5.6 M, CA Toronto 2.8 M, NZ Auckland 1.5 M, CH Zürich 415 k,
  NG Lagos 15.4 M, VN Ho Chi Minh City 14.0 M, MA Casablanca 3.7 M, KZ Almaty
  2.0 M, CI Abidjan 6.3 M, TZ Dar es Salaam 5.4 M, BJ Cotonou 679 k.
- Suspicious results that need overrides: **PK Lahore** (13.0 M) ranked above
  Karachi, **NL Rotterdam** (868 k) above Amsterdam (742 k). GeoNames
  populations are city proper and partly outdated.
- PS: the top entry is East Jerusalem with code `PPLX` (a section of a city),
  so exclude section codes.

## Flags

- **flag-icons 7.6.0** (MIT, 271 entries): flags in 4:3 and 1:1 crops only, not
  true proportions. Its `sy.svg` uses `#ce1126`, `#fff`, `#007a3d`: the old
  Syrian flag.
- **region-flags** (fonttools, last push 2024-05-02): true proportions (Qatar
  `viewBox="0 0 75 18"` with 1400×550, Nepal non-rectangular, Switzerland and
  Vatican City square), but also the old Syrian flag.
- **Wikimedia Commons** via the MediaWiki API (`prop=imageinfo`,
  `iiprop=size|extmetadata|timestamp|url`): `Flag of Syria.svg` resolves to
  `Flag_of_Syria_(2025-).svg`, 900×600, uploaded 2025-01-21, public domain.
  `Flag of Nepal.svg` 726×885, public domain. `Flag of Qatar.svg` 1400×550,
  public domain.

## Geometry

- Natural Earth latest release **5.1.2**, 2022-05-13, public domain.
- `ne_10m_admin_0_countries` fields include `SOVEREIGNT TYPE ADM0_A3 NAME ISO_A2
  ISO_A2_EH ISO_N3_EH MIN_ZOOM FCLASS_ISO`.
- Point-of-view editions exist for 33 countries
  (`ne_10m_admin_0_countries_arg … _vnm`, plus `_iso`, `_tlc`, `_lakes`).
- **world-atlas 2.0.2** is built from Natural Earth **4.1.0**:
  - `countries-110m.json` (105 KB): 177 shapes; **30 of the 197 missing**: AD AG
    BH BB KM CV DM FM GD KI KN XK LC LI MC MV MH MT MU NR PW SG SM ST SC TO TV VA
    VC WS.
  - `countries-50m.json` (739 KB): 241 shapes; **Tuvalu missing**, and Kosovo
    present without an ISO id.

## The globe (prototype)

A throwaway prototype (Canvas 2D, d3-geo 3.1.1, world-atlas 50m) was built
during research to check the look and the technique. Findings:

- The see-through effect works: a second orthographic projection rotated by
  `[λ + 180, −φ, −γ]` with `reflectX(true)` puts far-side points exactly where
  the unclipped orthographic formula puts them (checked numerically on four
  points, identical to 0.01 px).
- Testing 16,000 lattice points against the 1:50m land shape with
  `geoContains` in the browser froze the page. Land dots must be precomputed.
- Zooming in to fit small countries (6×) loses the globe feeling: dots thin
  out and far-side land turns into large shadows. Cap the zoom, fade the far
  side, switch to solid land when close.
- Two quick answers started two fly-to animations that fought each other.
  One interruptible camera is needed.
- `geoCentroid` of France (all polygons) is (−6.7°, 43.0°), in the Atlantic,
  and the United States' bounds span 172.5° to −67°. Views must come from the
  main landmass.
- "brasil" was rejected by exact matching. Alias lists and translations are
  needed.

## Capital status checks

- Indonesia: Wikipedia (2026-10-25) describes Nusantara as "a city under
  construction that, upon completion, is planned to be the capital city of
  Indonesia". Jakarta stays the capital in the data.

## Learning research cited in the brief

- Roediger, H. L., & Karpicke, J. D. (2006). Test-enhanced learning.
  *Psychological Science*, 17(3).
- Slamecka, N. J., & Graf, P. (1978). The generation effect. *Journal of
  Experimental Psychology: Human Learning and Memory*, 4(6).
- Cepeda, N. J., et al. (2006). Distributed practice in verbal recall tasks.
  *Psychological Bulletin*, 132(3).
- Kornell, N., & Bjork, R. A. (2008). Learning concepts and categories: is
  spacing the "enemy of induction"? *Psychological Science*, 19(6).
- FSRS: open-spaced-repetition, `ts-fsrs` on npm.

## Sources

- https://github.com/mledoze/countries
- https://download.geonames.org/export/dump/
- https://commons.wikimedia.org/w/api.php
- https://github.com/nvkelso/natural-earth-vector
- https://github.com/topojson/world-atlas
- https://github.com/lipis/flag-icons
- https://github.com/fonttools/region-flags
- https://en.wikipedia.org/wiki/Nusantara_(city)
