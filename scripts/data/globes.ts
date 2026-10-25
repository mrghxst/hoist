// Static globe images (PROMPT.md 4.4): the same look as the live globe —
// dots, the highlighted country, the capital — rendered at build time as
// small SVGs in light and dark, so flag pages need no JavaScript.
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { geoBounds, geoContains, geoGraticule, geoOrthographic, geoPath } from 'd3-geo';
import { feature, merge } from 'topojson-client';
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';
import type { Country } from '../../src/lib/data/types.ts';
import { STATIC, ensureDir, readJson } from './lib.ts';

const SIZE = 240;
const R = 104;
const LATTICE = 7000;

export interface Theme {
	name: 'light' | 'dark';
	ink: string;
	bg: string;
	accent: string;
}

export const THEMES: Theme[] = [
	{ name: 'light', ink: '#000000', bg: '#ffffff', accent: '#0070f3' },
	{ name: 'dark', ink: '#ffffff', bg: '#000000', accent: '#3291ff' }
];

export interface StaticGlobeData {
	land: MultiPolygon;
	countries: Map<string, Feature>;
	dots: [number, number][];
}

export function loadStaticData(): StaticGlobeData {
	const topo = readJson<Topology>(join(STATIC, 'geo/overview.topo.json'));
	const coll = topo.objects.countries as GeometryCollection;
	const fc = feature(topo, coll) as FeatureCollection;
	const countries = new Map<string, Feature>();
	for (const f of fc.features) if (f.id) countries.set(String(f.id), f);
	const land = merge(topo, coll.geometries as never) as MultiPolygon;

	// A coarser lattice than the live globe, so each file stays small.
	const polys: { poly: Polygon; b: [[number, number], [number, number]] }[] = land.coordinates.map((c) => {
		const poly: Polygon = { type: 'Polygon', coordinates: c };
		return { poly, b: geoBounds(poly) as [[number, number], [number, number]] };
	});
	const golden = Math.PI * (3 - Math.sqrt(5));
	const dots: [number, number][] = [];
	for (let i = 0; i < LATTICE; i++) {
		const lat = (Math.asin(1 - (2 * (i + 0.5)) / LATTICE) * 180) / Math.PI;
		let lon = ((golden * i * 180) / Math.PI) % 360;
		if (lon > 180) lon -= 360;
		for (const { poly, b } of polys) {
			if (lat < b[0][1] || lat > b[1][1]) continue;
			const inLon = b[0][0] <= b[1][0] ? lon >= b[0][0] && lon <= b[1][0] : lon >= b[0][0] || lon <= b[1][0];
			if (inLon && geoContains(poly, [lon, lat])) {
				dots.push([lon, lat]);
				break;
			}
		}
	}
	return { land, countries, dots };
}

const n = (x: number) => (Math.round(x * 10) / 10).toString();

export function renderGlobeSvg(c: Country, data: StaticGlobeData, t: Theme, size = SIZE): string {
	const scale = size / SIZE;
	const r = R * scale;
	const cx = size / 2;
	const cy = size / 2;
	const [lon, lat] = c.view.centre;
	const proj = geoOrthographic()
		.rotate([-lon, -lat])
		.scale(r)
		.translate([cx, cy])
		.clipAngle(90)
		.precision(0.8);
	const path = geoPath(proj).digits(1);

	// Dots, fading toward the edge of the disc, in four opacity steps.
	const lr = (lon * Math.PI) / 180;
	const pr = (lat * Math.PI) / 180;
	const steps: string[][] = [[], [], [], []];
	const d = 1.6 * scale;
	for (const [dl, dp] of data.dots) {
		const a = (dl * Math.PI) / 180;
		const b = (dp * Math.PI) / 180;
		const facing = Math.sin(pr) * Math.sin(b) + Math.cos(pr) * Math.cos(b) * Math.cos(a - lr);
		if (facing <= 0.03) continue;
		const p = proj([dl, dp]);
		if (!p) continue;
		// A zero-length subpath with square caps draws one dot.
		steps[Math.min(3, Math.floor(facing * 4))]!.push(`M${Math.round(p[0])} ${Math.round(p[1])}h0`);
	}
	const dotPaths = steps
		.map((list, i) =>
			list.length
				? `<path d="${list.join('')}" stroke="${t.ink}" stroke-opacity="${[0.22, 0.4, 0.6, 0.82][i]}" stroke-width="${n(d)}" stroke-linecap="square"/>`
				: ''
		)
		.join('');

	const target = data.countries.get(c.id);
	const targetPath = target ? path(target) ?? '' : '';
	const cap = proj([c.capital.lon, c.capital.lat]);
	// The graticule tolerates a coarser resampling, which keeps files small.
	const gratProj = geoOrthographic().rotate([-lon, -lat]).scale(r).translate([cx, cy]).clipAngle(90).precision(4);
	const grat = geoPath(gratProj).digits(0)(geoGraticule().step([10, 10]).precision(10)()) ?? '';
	const id = `g${c.id}${t.name}`;

	// Tiny countries get a ring so they are never lost (4.1).
	let ring = '';
	if (target) {
		const b = path.bounds(target);
		const span = Math.max(b[1][0] - b[0][0], b[1][1] - b[0][1]);
		const centre = proj(c.view.centre);
		if ((!Number.isFinite(span) || span < 12 * scale) && centre) {
			ring = `<circle cx="${n(centre[0])}" cy="${n(centre[1])}" r="${n(10 * scale)}" fill="none" stroke="${t.accent}" stroke-width="1.25"/>`;
		}
	}

	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img"><title>Globe showing ${c.name}</title><defs><radialGradient id="${id}b" cx="0.3" cy="0.28" r="0.85"><stop offset="0" stop-color="${t.ink}" stop-opacity="${t.name === 'dark' ? 0.1 : 0}"/><stop offset="1" stop-color="${t.ink}" stop-opacity="${t.name === 'dark' ? 0.03 : 0.05}"/></radialGradient><radialGradient id="${id}h"><stop offset="${n(1 / 1.08)}" stop-color="${t.ink}" stop-opacity="0.06"/><stop offset="1" stop-color="${t.ink}" stop-opacity="0"/></radialGradient></defs><circle cx="${cx}" cy="${cy}" r="${n(r * 1.08)}" fill="url(#${id}h)"/><circle cx="${cx}" cy="${cy}" r="${n(r)}" fill="url(#${id}b)"/><path d="${grat}" fill="none" stroke="${t.ink}" stroke-opacity="0.07" stroke-width="0.5"/>${dotPaths}<path d="${targetPath}" fill="${t.accent}" fill-opacity="0.28" stroke="${t.accent}" stroke-width="1.25" stroke-linejoin="round"/>${ring}${cap ? `<circle cx="${n(cap[0])}" cy="${n(cap[1])}" r="${n(4.5 * scale)}" fill="${t.bg}"/><circle cx="${n(cap[0])}" cy="${n(cap[1])}" r="${n(3 * scale)}" fill="${t.ink}"/>` : ''}<circle cx="${cx}" cy="${cy}" r="${n(r - 0.5)}" fill="none" stroke="${t.ink}" stroke-opacity="${t.name === 'dark' ? 0.28 : 0.16}"/></svg>`;
}

/** Writes static/globes/<slug>-light.svg and -dark.svg for every country. */
export function buildGlobes(countries: Country[]): number {
	const dir = join(STATIC, 'globes');
	rmSync(dir, { recursive: true, force: true });
	ensureDir(dir);
	const data = loadStaticData();
	let bytes = 0;
	for (const c of countries) {
		for (const t of THEMES) {
			const svg = renderGlobeSvg(c, data, t);
			bytes += svg.length;
			writeFileSync(join(dir, `${c.slug}-${t.name}.svg`), svg);
		}
	}
	return bytes;
}
