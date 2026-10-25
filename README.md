# Hoist

**Learn every flag of the world.** See a flag, type the country, and a glass
globe flies there and marks the capital and the largest city.

> Status: blueprint. Nothing is built yet. [PROMPT.md](PROMPT.md) is the full
> brief for building it; [docs/research.md](docs/research.md) holds the
> research behind it.

- **Type, don't pick.** Recalling a name sticks far better than choosing from a list.
- **Spaced repetition** (FSRS) decides what comes next, so every minute counts.
- **A semi-transparent globe** shows where each country is, its capital and its largest city.
- **Fun without noise:** daily challenge with a share grid, streaks, speed runs,
  lookalike duels, and a mastery globe that fills in as you learn.
- **Correct flags** in true proportions, built from Wikimedia Commons and checked weekly.
- **Minimal, fast and offline.** No account, no tracking, no ads.

## Stack

SvelteKit and Svelte 5, Canvas 2D with d3-geo, ts-fsrs, static hosting on
Cloudflare. Data from Natural Earth, GeoNames, mledoze/countries and Wikimedia
Commons.

## License

Code: MIT. Generated country data: ODbL (from mledoze/countries). See the
brief, section 8, for every data source and licence.
