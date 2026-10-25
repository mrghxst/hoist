// Countries, names, regions (8.1) and capitals and largest cities (8.3).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { normalize } from '../../src/lib/match/normalize.ts';
import type { Capital, City, Continent, Country, Region } from '../../src/lib/data/types.ts';
import { CURATED, RAW, download, fail, readJson } from './lib.ts';

const MLEDOZE_URL = 'https://raw.githubusercontent.com/mledoze/countries/5.1.0/countries.json';
const GEONAMES_URL = 'https://download.geonames.org/export/dump/cities1000.zip';

interface Mledoze {
	cca2: string;
	cca3: string;
	name: { common: string; official: string };
	altSpellings: string[];
	translations: Record<string, { common: string; official: string }>;
	region: string;
	subregion: string;
	capital: string[];
	area: number;
}

interface GeoName {
	id: string;
	name: string;
	ascii: string;
	alt: string[];
	lat: number;
	lon: number;
	code: string;
	cc: string;
	pop: number;
}

export interface Field<T> {
	value: T;
	source: string;
	checked: string;
}

export interface Override {
	name?: Field<string>;
	aliases?: Field<string[]>;
	capital?: Field<Partial<Capital> & { name: string }>;
	largest?: Field<City>;
	view?: Field<{ centre: [number, number]; zoom: number }>;
	flagNote?: Field<string>;
}

/** A country before geometry and flags are attached. */
export type Draft = Omit<Country, 'view' | 'tiny' | 'difficulty' | 'colours'> & {
	area: number;
	translations: Record<string, string[]>;
	/** Runner-up for the largest-city review report. */
	second?: City;
};

// Abandoned, historical, destroyed and section-of-city places (8.3).
const SKIP_CODES = new Set(['PPLX', 'PPLH', 'PPLQ', 'PPLW', 'PPLCH']);

export function loadOverrides(): Record<string, Override> {
	const all = readJson<Record<string, Override | string>>(join(CURATED, 'overrides.json'));
	const out: Record<string, Override> = {};
	for (const [cc, o] of Object.entries(all)) {
		if (cc.startsWith('_') || typeof o === 'string') continue;
		for (const [field, f] of Object.entries(o)) {
			const v = f as Field<unknown>;
			if (!v || !v.source || !/^https?:\/\//.test(v.source) || !/^\d{4}-\d{2}-\d{2}$/.test(v.checked ?? '')) {
				fail(`override ${cc}.${field} needs a source URL and a checked date`);
			}
		}
		out[cc] = o;
	}
	return out;
}

async function loadGeoNames(): Promise<Map<string, GeoName[]>> {
	const zip = await download(GEONAMES_URL, 'cities1000.zip');
	const txt = join(RAW, 'cities1000.txt');
	if (!existsSync(txt)) execFileSync('unzip', ['-o', '-q', zip, '-d', RAW]);
	const byCountry = new Map<string, GeoName[]>();
	for (const line of readFileSync(txt, 'utf8').split('\n')) {
		const f = line.split('\t');
		if (f.length < 15) continue;
		const g: GeoName = {
			id: f[0]!,
			name: f[1]!,
			ascii: f[2]!,
			alt: f[3] ? f[3].split(',') : [],
			lat: Number(f[4]),
			lon: Number(f[5]),
			code: f[7]!,
			cc: f[8]!,
			pop: Number(f[14]) || 0
		};
		let list = byCountry.get(g.cc);
		if (!list) byCountry.set(g.cc, (list = []));
		list.push(g);
	}
	return byCountry;
}

function continentOf(m: Mledoze): Continent {
	if (m.region === 'Antarctic') return 'Oceania';
	return m.region as Continent;
}

function regionOf(m: Mledoze): Region {
	switch (m.region) {
		case 'Europe':
			return 'europe';
		case 'Africa':
			return 'africa';
		case 'Asia':
			return 'asia';
		case 'Oceania':
			return 'oceania';
		case 'Americas':
			if (m.subregion === 'South America') return 'south-america';
			if (m.subregion === 'Caribbean') return 'caribbean';
			return 'north-america';
	}
	throw new Error(`no region for ${m.cca2}`);
}

export function slugify(name: string): string {
	return name
		.toLowerCase()
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.replace(/['’]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}

function uniq(list: string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const s of list) {
		const t = s.trim();
		const k = normalize(t);
		if (!t || !k || seen.has(k)) continue;
		seen.add(k);
		out.push(t);
	}
	return out;
}

function sameName(a: string, g: GeoName): boolean {
	const n = normalize(a);
	return [g.name, g.ascii, ...g.alt].some((x) => normalize(x) === n);
}

function toCity(g: GeoName): City {
	return { name: g.name, lat: round(g.lat), lon: round(g.lon), pop: g.pop };
}

const round = (n: number) => Math.round(n * 1e5) / 1e5;

export async function buildCountries(ids: { core: string[]; territories: string[] }): Promise<Draft[]> {
	const mledoze = readJson<Mledoze[]>(await download(MLEDOZE_URL, 'countries.json'));
	const aliases = readJson<{ aliases: Record<string, string[]> }>(join(CURATED, 'aliases.json')).aliases;
	const overrides = loadOverrides();
	const geonames = await loadGeoNames();

	const wanted = [...ids.core.map((id) => [id, 'core'] as const), ...ids.territories.map((id) => [id, 'territories'] as const)];
	const drafts: Draft[] = [];

	for (const [id, pack] of wanted) {
		const m = mledoze.find((x) => x.cca2 === id);
		if (!m) fail(`${id} is not in mledoze/countries`);
		const o = overrides[id] ?? {};
		const name = o.name?.value ?? m.name.common;

		const alt = m.altSpellings.filter((s) => s !== m.cca2 && s !== m.cca3);
		const names = uniq([name, m.name.common, m.name.official, ...alt, ...(aliases[id] ?? []), ...(o.aliases?.value ?? [])]);

		const translations: Record<string, string[]> = {};
		for (const [lang, t] of Object.entries(m.translations)) translations[lang] = uniq([t.common, t.official]);

		const places = (geonames.get(id) ?? []).filter((g) => !SKIP_CODES.has(g.code));

		// Capital: the PPLC matched against the data's capital name (8.3).
		const capName = o.capital?.value.name ?? m.capital[0];
		if (!capName) fail(`${id} has no capital name; add an override`);
		let capital: Capital;
		const oc = o.capital?.value;
		if (oc?.lat !== undefined && oc.lon !== undefined) {
			capital = { name: capName, lat: oc.lat, lon: oc.lon };
		} else {
			const pplc = places.filter((g) => g.code === 'PPLC');
			const named = places.filter((g) => sameName(capName, g)).sort((a, b) => b.pop - a.pop);
			const pick =
				pplc.find((g) => sameName(capName, g)) ??
				(oc ? named[0] : undefined) ??
				(pplc.length === 1 ? pplc[0] : undefined) ??
				named[0];
			if (!pick) fail(`${id}: no GeoNames place for capital "${capName}"`);
			capital = { name: capName, lat: round(pick.lat), lon: round(pick.lon), pop: pick.pop };
		}
		if (oc?.note) capital.note = oc.note;
		if (oc?.alts) capital.alts = oc.alts;

		// Largest city: most populous place, unless overridden (8.3).
		const ranked = [...places].sort((a, b) => b.pop - a.pop);
		let largest: City;
		if (o.largest) {
			largest = o.largest.value;
		} else {
			const top = ranked[0];
			if (!top) fail(`${id}: no GeoNames places`);
			largest = toCity(top);
		}
		const second = ranked.find((g) => normalize(g.name) !== normalize(largest.name));

		const same =
			normalize(largest.name) === normalize(capital.name) ||
			(Math.abs(largest.lat - capital.lat) < 0.05 && Math.abs(largest.lon - capital.lon) < 0.05);
		if (same) {
			// One marker: keep the capital's display name, take the population.
			largest = { ...largest, name: capital.name, lat: capital.lat, lon: capital.lon };
		}

		drafts.push({
			id,
			cca3: m.cca3,
			slug: slugify(name),
			name,
			official: m.name.official,
			names,
			continent: continentOf(m),
			region: regionOf(m),
			subregion: m.subregion,
			pack,
			capital,
			largest,
			same,
			...(o.flagNote ? { flagNote: o.flagNote.value } : {}),
			area: m.area,
			translations,
			second: second ? toCity(second) : undefined
		});
	}
	return drafts;
}
