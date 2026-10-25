// Audits (8.7) on the committed data. The build fails if any fails.
// Run on its own with `pnpm audit:data` (no network needed).
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { geoContains } from 'd3-geo';
import { feature } from 'topojson-client';
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { normalize } from '../../src/lib/match/normalize.ts';
import type { Country, Flag, LookalikeGroup } from '../../src/lib/data/types.ts';
import { distanceKm } from './geometry.ts';
import { loadOverrides } from './countries.ts';
import { CURATED, OUT, STATIC, readJson } from './lib.ts';

const BUDGET = 30 * 1024;
const NEAR_KM = 25;

export interface AuditResult {
	errors: string[];
	warnings: string[];
	checks: number;
}

function polygonsById(path: string): Map<string, Polygon[]> {
	const t = readJson<Topology>(path);
	const fc = feature(t, t.objects.countries as GeometryCollection) as FeatureCollection;
	const map = new Map<string, Polygon[]>();
	for (const f of fc.features) {
		const g = f.geometry as Polygon | MultiPolygon | null;
		if (!g || f.id === undefined) continue;
		const list = map.get(String(f.id)) ?? [];
		if (g.type === 'Polygon') list.push(g);
		else for (const c of g.coordinates) list.push({ type: 'Polygon', coordinates: c });
		map.set(String(f.id), list);
	}
	return map;
}

export function audit(): AuditResult {
	const errors: string[] = [];
	const warnings: string[] = [];
	let checks = 0;
	const check = (ok: boolean, message: string, strict: boolean) => {
		checks++;
		if (!ok) (strict ? errors : warnings).push(message);
	};

	const countries = readJson<Country[]>(join(OUT, 'countries.json'));
	const flags = readJson<Record<string, Flag>>(join(OUT, 'flags.json'));
	const groups = readJson<{ groups: LookalikeGroup[] }>(join(CURATED, 'lookalikes.json')).groups;
	const ambiguous = readJson<{ ambiguous: Record<string, string[]> }>(join(CURATED, 'aliases.json')).ambiguous;
	const core = readJson<{ countries: string[] }>(join(CURATED, 'set-197.json')).countries;
	const detail = polygonsById(join(STATIC, 'geo/detail.topo.json'));
	const overview = polygonsById(join(STATIC, 'geo/overview.topo.json'));

	check(core.length === 197, `set-197.json has ${core.length} countries`, true);
	for (const id of core) check(countries.some((c) => c.id === id), `${id} is missing from countries.json`, true);

	for (const c of countries) {
		const strict = c.pack === 'core';
		const tag = `${c.id} ${c.name}`;
		check(!!c.name && c.names.length > 0, `${tag}: no names`, strict);
		check(!!c.region && !!c.continent, `${tag}: no region`, strict);
		check(Number.isFinite(c.capital?.lat) && Number.isFinite(c.capital?.lon), `${tag}: capital has no coordinates`, strict);
		check(Number.isFinite(c.largest?.lat) && Number.isFinite(c.largest?.lon), `${tag}: largest city has no coordinates`, strict);
		check(!!c.view && c.view.zoom >= 0.9 && c.view.zoom <= 4, `${tag}: no view or zoom out of range`, strict);

		const f = flags[c.id];
		check(!!f, `${tag}: no flag`, strict);
		if (f) {
			const file = join(STATIC, f.svg);
			check(existsSync(file), `${tag}: flag file ${f.svg} missing`, strict);
			const size = existsSync(file) ? statSync(file).size : 0;
			check(size <= BUDGET || (!!f.webp && existsSync(join(STATIC, f.webp))), `${tag}: flag over 30 KB without WebP`, strict);
			check(f.ratio > 0.5 && f.ratio < 3, `${tag}: odd flag ratio ${f.ratio}`, strict);
			check(!f.svg.toLowerCase().includes(c.id.toLowerCase() + '.') && !f.svg.includes(c.slug), `${tag}: flag file name leaks the answer`, true);
		}

		const polys = detail.get(c.id);
		check(!!polys?.length, `${tag}: no polygon in detail geometry`, strict);
		check(!!overview.get(c.id)?.length, `${tag}: no polygon in overview geometry`, strict);
		if (polys?.length) {
			const capKm = distanceKm(polys, [c.capital.lon, c.capital.lat]);
			check(capKm <= NEAR_KM, `${tag}: capital ${c.capital.name} is ${capKm.toFixed(0)} km outside the country`, strict);
			const bigKm = distanceKm(polys, [c.largest.lon, c.largest.lat]);
			check(bigKm <= NEAR_KM, `${tag}: largest city ${c.largest.name} is ${bigKm.toFixed(0)} km outside the country`, strict);
			const inside = polys.some((p) => geoContains(p, c.view.centre));
			check(inside, `${tag}: view centre ${c.view.centre.join(', ')} is outside the country`, strict);
		}
	}

	// No two countries share a normalised accepted name, except the whitelist.
	const allowed = new Set(Object.keys(ambiguous).map(normalize));
	const owner = new Map<string, string>();
	for (const c of countries.filter((x) => x.pack === 'core')) {
		for (const n of c.names) {
			const k = normalize(n);
			const prev = owner.get(k);
			check(!prev || prev === c.id || allowed.has(k), `name "${n}" is used by ${prev} and ${c.id}`, true);
			owner.set(k, c.id);
		}
	}
	for (const [name, ids] of Object.entries(ambiguous)) {
		for (const id of ids) check(countries.some((c) => c.id === id), `ambiguous "${name}" lists unknown ${id}`, true);
	}

	for (const g of groups) {
		for (const id of g.members) check(countries.some((c) => c.id === id), `lookalike group ${g.id}: unknown ${id}`, true);
		check(g.tip.length > 20, `lookalike group ${g.id}: no tip`, true);
	}

	// Every override has a source and a date (loadOverrides exits otherwise).
	loadOverrides();
	checks++;

	return { errors, warnings, checks };
}

// Run directly: `node scripts/data/audit.ts`
if (import.meta.main) {
	const r = audit();
	for (const w of r.warnings) console.warn(`  warning: ${w}`);
	for (const e of r.errors) console.error(`  ✗ ${e}`);
	console.log(`${r.checks} checks, ${r.errors.length} errors, ${r.warnings.length} warnings`);
	if (r.errors.length) process.exit(1);
}

