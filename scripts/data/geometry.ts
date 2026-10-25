// Geometry (8.5): Natural Earth 5.1.2 into overview and detail TopoJSON,
// land dots on a Fibonacci lattice, and a precomputed view per country.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import mapshaper from 'mapshaper';
import { geoArea, geoBounds, geoCentroid, geoContains, geoDistance } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from 'geojson';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { City, View } from '../../src/lib/data/types.ts';
import { STATIC, download, ensureDir, gzSize, readJson } from './lib.ts';

const NE_URL =
	'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_admin_0_countries.geojson';

/** mapshaper `-simplify` percentages, tuned to the size targets in 8.5. */
const OVERVIEW_SIMPLIFY = '6%';
const DETAIL_SIMPLIFY = '28%';
const DOT_COUNT = 40000;
/** Zoom limits (4.2) and the share of the globe radius a country should fill. */
const ZOOM_MIN = 0.9;
const ZOOM_MAX = 4;
const FILL = 0.42;
/** Reference globe radius on a phone, in px, for the `tiny` flag (4.1). */
const REFERENCE_RADIUS = 170;
const TINY_PX = 20;

export interface Geometry {
	overview: Topology;
	detail: Topology;
	/** Polygons per country id, from the detail geometry. */
	polygons: Map<string, Polygon[]>;
	overviewPolygons: Map<string, Polygon[]>;
	/** Natural Earth population estimate per country id. */
	population: Map<string, number>;
	sizes: { overview: number; detail: number; dots: number; dotCount: number };
}

type NEProps = { ISO_A2_EH: string; ADM0_A3: string; NAME: string; POP_EST: number };

function idOf(p: NEProps): string | null {
	if (p.ADM0_A3 === 'KOS') return 'XK';
	if (p.ISO_A2_EH && p.ISO_A2_EH !== '-99') return p.ISO_A2_EH;
	return null;
}

async function topo(input: FeatureCollection, simplify: string, quantization: number): Promise<Topology> {
	const out = await mapshaper.applyCommands(
		`-i in.json -dissolve2 id -simplify ${simplify} weighted keep-shapes -rename-layers countries ` +
			`-o out.json format=topojson quantization=${quantization} id-field=id`,
		{ 'in.json': input }
	);
	const t = JSON.parse(String(out['out.json'])) as Topology;
	const coll = t.objects.countries as GeometryCollection;
	for (const g of coll.geometries) {
		delete (g as { properties?: unknown }).properties;
		if (!g.id) delete g.id;
	}
	return t;
}

function polygonsOf(t: Topology): Map<string, Polygon[]> {
	const fc = feature(t, t.objects.countries as GeometryCollection) as FeatureCollection;
	const map = new Map<string, Polygon[]>();
	for (const f of fc.features) {
		const id = String(f.id ?? '');
		const list = map.get(id) ?? [];
		const g = f.geometry as Polygon | MultiPolygon | null;
		if (!g) continue;
		if (g.type === 'Polygon') list.push(g);
		else for (const coords of g.coordinates) list.push({ type: 'Polygon', coordinates: coords });
		map.set(id, list);
	}
	return map;
}

/** Points on a Fibonacci sphere lattice, kept where they fall on land. */
function landDots(polygons: Map<string, Polygon[]>): Int16Array {
	const all: { poly: Polygon; bounds: [[number, number], [number, number]] }[] = [];
	for (const list of polygons.values()) {
		for (const poly of list) all.push({ poly, bounds: geoBounds(poly) as [[number, number], [number, number]] });
	}
	const golden = Math.PI * (3 - Math.sqrt(5));
	const out: number[] = [];
	for (let i = 0; i < DOT_COUNT; i++) {
		const y = 1 - (2 * (i + 0.5)) / DOT_COUNT;
		const lat = (Math.asin(y) * 180) / Math.PI;
		let lon = ((golden * i * 180) / Math.PI) % 360;
		if (lon > 180) lon -= 360;
		const p: [number, number] = [lon, lat];
		for (const { poly, bounds } of all) {
			const [[x0, y0], [x1, y1]] = bounds;
			if (lat < y0 || lat > y1) continue;
			const inLon = x0 <= x1 ? lon >= x0 && lon <= x1 : lon >= x0 || lon <= x1;
			if (!inLon) continue;
			if (geoContains(poly, p)) {
				out.push(Math.round(lon * 100), Math.round(lat * 100));
				break;
			}
		}
	}
	return Int16Array.from(out);
}

export async function buildGeometry(): Promise<Geometry> {
	const ne = readJson<FeatureCollection<Polygon | MultiPolygon, NEProps>>(
		await download(NE_URL, 'ne_10m_admin_0_countries.geojson')
	);
	const input: FeatureCollection = {
		type: 'FeatureCollection',
		features: ne.features.map((f) => ({
			type: 'Feature',
			properties: { id: idOf(f.properties) },
			geometry: f.geometry
		}))
	};

	const population = new Map<string, number>();
	for (const f of ne.features) {
		const id = idOf(f.properties);
		if (id) population.set(id, (population.get(id) ?? 0) + Math.max(0, f.properties.POP_EST || 0));
	}

	const overview = await topo(input, OVERVIEW_SIMPLIFY, 1e5);
	const detail = await topo(input, DETAIL_SIMPLIFY, 1e6);
	const polygons = polygonsOf(detail);
	const overviewPolygons = polygonsOf(overview);
	const dots = landDots(polygons);

	const geo = join(STATIC, 'geo');
	ensureDir(geo);
	const overviewJson = JSON.stringify(overview);
	const detailJson = JSON.stringify(detail);
	writeFileSync(join(geo, 'overview.topo.json'), overviewJson);
	writeFileSync(join(geo, 'detail.topo.json'), detailJson);
	const dotBytes = new Uint8Array(dots.buffer);
	writeFileSync(join(geo, 'land-dots.bin'), dotBytes);

	return {
		overview,
		detail,
		polygons,
		overviewPolygons,
		population,
		sizes: {
			overview: gzSize(overviewJson),
			detail: gzSize(detailJson),
			dots: gzSize(dotBytes),
			dotCount: dots.length / 2
		}
	};
}

function ringPoints(polys: Polygon[]): Position[] {
	return polys.flatMap((p) => p.coordinates[0] ?? []);
}

/** Distance in km from a point to a polygon (0 inside); vertex approximation. */
export function distanceKm(polys: Polygon[], p: [number, number]): number {
	if (polys.some((poly) => geoContains(poly, p))) return 0;
	let best = Infinity;
	for (const poly of polys) {
		for (const ring of poly.coordinates) {
			for (let i = 1; i < ring.length; i++) {
				const a = ring[i - 1] as [number, number];
				const b = ring[i] as [number, number];
				// Sample the edge so long simplified edges are measured fairly.
				const steps = Math.max(1, Math.ceil(geoDistance(a, b) / 0.002));
				for (let s = 0; s <= steps; s++) {
					const t = s / steps;
					const q: [number, number] = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
					best = Math.min(best, geoDistance(p, q));
				}
			}
		}
	}
	return best * 6371;
}

function containing(polys: Polygon[], p: [number, number]): Polygon | undefined {
	return (
		polys.find((poly) => geoContains(poly, p)) ??
		[...polys].sort((a, b) => distanceKm([a], p) - distanceKm([b], p))[0]
	);
}

/** A point inside the polygon, as close as possible to `target`. */
function interiorPoint(poly: Polygon, target: [number, number]): [number, number] {
	if (geoContains(poly, target)) return target;
	const [[x0, y0], [x1, y1]] = geoBounds(poly) as [[number, number], [number, number]];
	const w = x1 >= x0 ? x1 - x0 : x1 + 360 - x0;
	let best: [number, number] | undefined;
	let bestD = Infinity;
	const n = 40;
	for (let i = 0; i <= n; i++) {
		for (let j = 0; j <= n; j++) {
			let lon = x0 + (w * i) / n;
			if (lon > 180) lon -= 360;
			const p: [number, number] = [lon, y0 + ((y1 - y0) * j) / n];
			if (!geoContains(poly, p)) continue;
			const d = geoDistance(p, target);
			if (d < bestD) {
				bestD = d;
				best = p;
			}
		}
	}
	return best ?? (poly.coordinates[0]![0] as [number, number]);
}

/**
 * The view (4.2, 8.5): frame the main landmass plus the polygons holding the
 * capital and the largest city, never the centroid of all parts.
 */
export function computeView(polys: Polygon[], capital: City, largest: City): { view: View; tiny: boolean } {
	const byArea = [...polys].sort((a, b) => geoArea(b) - geoArea(a));
	const main = byArea[0]!;
	const set = new Set<Polygon>([main]);
	const cap = containing(polys, [capital.lon, capital.lat]);
	const big = containing(polys, [largest.lon, largest.lat]);
	if (cap) set.add(cap);
	if (big) set.add(big);
	const framed = [...set];

	const multi: MultiPolygon = { type: 'MultiPolygon', coordinates: framed.map((p) => p.coordinates) };
	let centre = geoCentroid(multi) as [number, number];
	if (!framed.some((p) => geoContains(p, centre))) {
		const anchor = cap && cap !== main && geoArea(cap) * 4 > geoArea(main) ? cap : main;
		centre = interiorPoint(anchor, geoCentroid(anchor) as [number, number]);
		if (!framed.some((p) => geoContains(p, centre))) centre = interiorPoint(main, centre);
	}

	let radius = 0;
	for (const v of ringPoints(framed)) radius = Math.max(radius, geoDistance(centre, v as [number, number]));
	radius = Math.max(radius, 0.0005);
	const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, FILL / Math.sin(Math.min(radius, Math.PI / 2))));

	// Size of the main landmass on screen at that zoom, on a phone-sized globe.
	let mainRadius = 0;
	const mc = geoCentroid(main) as [number, number];
	for (const v of main.coordinates[0] ?? []) mainRadius = Math.max(mainRadius, geoDistance(mc, v as [number, number]));
	const px = 2 * REFERENCE_RADIUS * zoom * Math.sin(mainRadius);

	const r = (n: number, d = 3) => Math.round(n * 10 ** d) / 10 ** d;
	return {
		view: { centre: [r(centre[0], 5), r(centre[1], 5)], zoom: r(zoom, 2), radius: r((radius * 180) / Math.PI, 2) },
		tiny: px < TINY_PX
	};
}

export type { Feature };
