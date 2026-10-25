// The data pipeline (PROMPT.md 8): `pnpm data` re-runs all of it.
//   --discover   read missing Commons file names from Wikipedia infoboxes
import { join } from 'node:path';
import { buildCountries, type Draft } from './countries.ts';
import { buildGeometry, computeView, type Geometry } from './geometry.ts';
import { buildFlags, discoverSources, type FlagBuild } from './flags.ts';
import { comparePairs, signature, type Signature } from './lookalikes.ts';
import { audit } from './audit.ts';
import { buildGlobes } from './globes.ts';
import { loadOverrides } from './countries.ts';
import type { Country, GameData, LookalikeGroup } from '../../src/lib/data/types.ts';
import { CURATED, OUT, REPORTS, TODAY, kb, readJson, writeJson, writeText } from './lib.ts';

const args = new Set(process.argv.slice(2));
const t0 = Date.now();
const step = (s: string) => console.log(`\n▸ ${s} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);

const core = readJson<{ countries: string[] }>(join(CURATED, 'set-197.json')).countries;
const territories = readJson<{ countries: string[] }>(join(CURATED, 'territories.json')).countries;
const starter = readJson<{ starter: string[]; familiar: string[] }>(join(CURATED, 'starter.json'));
const groups = readJson<{ groups: LookalikeGroup[] }>(join(CURATED, 'lookalikes.json')).groups;
const overrides = loadOverrides();

step('Countries, capitals and largest cities');
const drafts = await buildCountries({ core, territories });

step('Geometry, land dots and views');
const geometry = await buildGeometry();

if (args.has('--discover')) {
	step('Discovering Commons files from Wikipedia infoboxes');
	await discoverSources(drafts.map((d) => ({ id: d.id, name: d.name, common: d.names[1] ?? d.name })));
}

step('Flags from Wikimedia Commons');
const flagBuild = await buildFlags(drafts.map((d) => d.id));

step('Lookalike candidates and colours');
const sigs = new Map<string, Signature>();
for (const d of drafts) sigs.set(d.id, await signature(flagBuild.svgs.get(d.id)!));
const pairReport = comparePairs(
	new Map([...sigs].filter(([id]) => core.includes(id))),
	groups
);

step('Writing data');
const countries = finish(drafts, geometry, sigs);
writeJson(join(OUT, 'countries.json'), countries, false);
writeJson(join(OUT, 'flags.json'), flagBuild.flags, false);
writeJson(join(OUT, 'translations.json'), translations(drafts), false);
writeJson(join(OUT, 'lookalikes.json'), groups, false);
writeJson(join(OUT, 'starter.json'), starter.starter, false);
writeJson(join(OUT, 'game.json'), game(countries, flagBuild), false);

step('Static globes');
const globeBytes = buildGlobes(countries);

step('Reports');
writeText(join(REPORTS, 'largest-city.md'), largestCityReport(drafts));
writeText(join(REPORTS, 'lookalikes.md'), lookalikeReport(pairReport, countries));

step('Audits');
const result = audit();
writeText(join(REPORTS, 'data-summary.md'), summary(countries, geometry, flagBuild, result, globeBytes));
for (const w of [...flagBuild.warnings, ...result.warnings]) console.warn(`  warning: ${w}`);
for (const e of result.errors) console.error(`  ✗ ${e}`);
console.log(`\n${result.checks} checks, ${result.errors.length} errors. Done in ${((Date.now() - t0) / 1000).toFixed(0)} s.`);
if (result.errors.length) process.exit(1);

// ---------------------------------------------------------------------------

function finish(drafts: Draft[], geometry: Geometry, sigs: Map<string, Signature>): Country[] {
	const inGroup = new Set(groups.flatMap((g) => g.members));
	const byPop = [...geometry.population.entries()]
		.filter(([id]) => core.includes(id))
		.sort((a, b) => b[1] - a[1])
		.map(([id]) => id);

	const out: Country[] = drafts.map((d) => {
		const polys = geometry.polygons.get(d.id);
		if (!polys?.length) throw new Error(`${d.id} has no geometry`);
		const computed = computeView(polys, d.capital, d.largest);
		const o = overrides[d.id]?.view?.value;
		const view = o ? { ...computed.view, centre: o.centre, zoom: o.zoom } : computed.view;
		const rank = byPop.indexOf(d.id);
		const difficulty: 1 | 2 | 3 = starter.familiar.includes(d.id)
			? 1
			: rank >= 0 && ((rank < 110 && !inGroup.has(d.id)) || rank < 50)
				? 2
				: 3;
		const { area: _a, translations: _t, second: _s, ...rest } = d;
		return { ...rest, view, tiny: computed.tiny, difficulty, colours: sigs.get(d.id)?.colours ?? [] };
	});
	return out.sort((a, b) => a.name.localeCompare(b.name, 'en'));
}

function game(countries: Country[], f: FlagBuild): GameData {
	const ambiguous = readJson<{ ambiguous: Record<string, string[]> }>(join(CURATED, 'aliases.json')).ambiguous;
	return {
		countries: countries.map((c) => {
			const flag = f.flags[c.id]!;
			const { cca3: _c, official: _o, subregion: _s, flagNote: _n, ...rest } = c;
			return { ...rest, flag: flag.webp ?? flag.svg, ratio: flag.ratio };
		}),
		lookalikes: groups,
		ambiguous,
		starter: starter.starter,
		familiar: starter.familiar
	};
}

function translations(drafts: Draft[]): Record<string, Record<string, string[]>> {
	const out: Record<string, Record<string, string[]>> = {};
	for (const d of drafts) {
		for (const [lang, names] of Object.entries(d.translations)) (out[lang] ??= {})[d.id] = names;
	}
	return out;
}

function fmt(n?: number) {
	return n === undefined ? '–' : n.toLocaleString('en-US');
}

function largestCityReport(drafts: Draft[]): string {
	const rows = drafts
		.filter((d) => d.second && d.largest.pop && d.second.pop! >= 0.75 * d.largest.pop)
		.map((d) => {
			const fixed = overrides[d.id]?.largest ? `override (${overrides[d.id]!.largest!.source})` : 'GeoNames';
			return `| ${d.id} | ${d.name} | ${d.largest.name} | ${fmt(d.largest.pop)} | ${d.second!.name} | ${fmt(d.second!.pop)} | ${fixed} |`;
		});
	const overridden = drafts
		.filter((d) => overrides[d.id]?.largest)
		.map((d) => `- ${d.id} ${d.name}: ${d.largest.name} ([source](${overrides[d.id]!.largest!.source}))`);
	return `# Largest city review

Generated by \`pnpm data\` on ${TODAY}. GeoNames populations are city proper
and partly outdated (PROMPT.md 8.3). Countries whose top two places are within
25% of each other are listed for review; wrong ones are fixed in
\`data/overrides.json\` with a source.

| | Country | Largest | Population | Runner-up | Population | Decided by |
|---|---|---|---:|---|---:|---|
${rows.join('\n')}

## Overrides

${overridden.join('\n')}
`;
}

function lookalikeReport(r: ReturnType<typeof comparePairs>, countries: Country[]): string {
	const name = (id: string) => countries.find((c) => c.id === id)?.name ?? id;
	const rows = r.pairs.map(
		(p, i) => `| ${i + 1} | ${name(p.a)} | ${name(p.b)} | ${p.d.toFixed(3)} | ${p.curated ? 'curated' : ''} |`
	);
	const g = r.groups.map((x) => `| ${x.id} | ${x.width.toFixed(3)} |`);
	return `# Lookalike candidates

Generated by \`pnpm data\` on ${TODAY} (PROMPT.md 8.6). Each flag is rasterised
to 64×40, converted to Lab, and compared by colour histogram (40%) and an 8×5
layout grid (60%). Lower is closer. Humans decide what goes into
\`data/lookalikes.json\`; only curated groups ship.

The widest curated group spans ${r.groupWidth.toFixed(3)}. Listed: the 60
closest pairs, then uncurated pairs closer than that width.

| # | Flag | Flag | Distance | |
|---:|---|---|---:|---|
${rows.join('\n')}

## Curated groups

| Group | Widest pair |
|---|---:|
${g.join('\n')}
`;
}

function summary(countries: Country[], g: Geometry, f: FlagBuild, a: ReturnType<typeof audit>, globeBytes: number): string {
	const coreList = countries.filter((c) => c.pack === 'core');
	const webp = Object.entries(f.flags).filter(([, x]) => x.webp);
	const tiny = coreList.filter((c) => c.tiny).map((c) => c.name);
	const byRegion = new Map<string, number>();
	for (const c of coreList) byRegion.set(c.region, (byRegion.get(c.region) ?? 0) + 1);
	const largestFlags = Object.entries(f.flags)
		.sort((x, y) => y[1].bytes - x[1].bytes)
		.slice(0, 8)
		.map(([id, x]) => `${id} ${kb(x.bytes)}`);
	return `# Data summary

Generated by \`pnpm data\` on ${TODAY}.

## Counts

- Countries: ${coreList.length} core, ${countries.length - coreList.length} in the territories pack
- By region: ${[...byRegion].map(([r, n]) => `${r} ${n}`).join(', ')}
- Tiny (ringed on the globe): ${tiny.length} (${tiny.join(', ')})
- Difficulty: easy ${coreList.filter((c) => c.difficulty === 1).length}, medium ${coreList.filter((c) => c.difficulty === 2).length}, hard ${coreList.filter((c) => c.difficulty === 3).length}
- Capital is also the largest city: ${coreList.filter((c) => c.same).length}
- Overrides: ${Object.keys(overrides).length} countries

## Sizes (gzipped where noted)

- Overview geometry: ${kb(g.sizes.overview)} gzipped (target ≤ 120 KB)
- Detail geometry: ${kb(g.sizes.detail)} gzipped (target ≤ 600 KB)
- Land dots: ${g.sizes.dotCount} dots, ${kb(g.sizes.dots)} gzipped (target ≤ 60 KB)
- Overview + dots: ${kb(g.sizes.overview + g.sizes.dots)} gzipped (budget ≤ 180 KB)
- Flags: ${kb(f.total)} in total, SVG plus WebP (target < 2 MB)
- Largest flag SVGs: ${largestFlags.join(', ')}
- Static globe SVGs: ${countries.length * 2} files, ${kb(globeBytes)} (average ${kb(globeBytes / countries.length / 2)})
- WebP fallbacks (SVG over 30 KB): ${webp.length} (${webp.map(([id]) => id).join(', ')})

## Audits

${a.checks} checks, ${a.errors.length} errors, ${a.warnings.length} warnings.

${[...a.errors.map((e) => `- ✗ ${e}`), ...a.warnings.map((w) => `- warning: ${w}`), ...f.warnings.map((w) => `- flag: ${w}`)].join('\n') || 'All passed.'}
`;
}
