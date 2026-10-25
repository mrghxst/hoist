/** Loads and prepares the globe geometry (PROMPT.md 4.3, 8.5). */
import { feature, merge, mesh } from 'topojson-client';
import type { Feature, MultiLineString, MultiPolygon, Polygon } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { shapeOf, type Shape } from './sphere.ts';

export interface Dots {
	lons: Float32Array;
	lats: Float32Array;
	/** Unit vectors, for the cheap far-side test. */
	xs: Float32Array;
	ys: Float32Array;
	zs: Float32Array;
}

export interface GlobeData {
	land: MultiPolygon;
	/** A coarser land outline for the faint far side. */
	farLand: MultiPolygon;
	borders: MultiLineString;
	countries: Map<string, Feature>;
	detail?: Map<string, Feature>;
	dots: Dots;
	/** The same geometry as unit vectors, for the renderer. */
	/** `*Fast` are lighter versions drawn while the globe moves. */
	shapes: { land: Shape; landFast: Shape; farLand: Shape; farLandFast: Shape; borders: Shape; bordersFast: Shape };
}

export const OVERVIEW_URL = '/geo/overview.topo.json';
export const DETAIL_URL = '/geo/detail.topo.json';
export const DOTS_URL = '/geo/land-dots.bin';

export function decodeDots(buffer: ArrayBuffer): Dots {
	const raw = new Int16Array(buffer);
	const n = raw.length / 2;
	const lons = new Float32Array(n);
	const lats = new Float32Array(n);
	const xs = new Float32Array(n);
	const ys = new Float32Array(n);
	const zs = new Float32Array(n);
	for (let i = 0; i < n; i++) {
		const lon = raw[i * 2]! / 100;
		const lat = raw[i * 2 + 1]! / 100;
		lons[i] = lon;
		lats[i] = lat;
		const l = (lon * Math.PI) / 180;
		const p = (lat * Math.PI) / 180;
		xs[i] = Math.cos(p) * Math.cos(l);
		ys[i] = Math.cos(p) * Math.sin(l);
		zs[i] = Math.sin(p);
	}
	return { lons, lats, xs, ys, zs };
}

export function countriesOf(topo: Topology): Map<string, Feature> {
	const coll = topo.objects.countries as GeometryCollection;
	const fc = feature(topo, coll);
	const map = new Map<string, Feature>();
	for (const f of fc.features) if (f.id !== undefined && f.id !== '') map.set(String(f.id), f as Feature);
	return map;
}

/** Keeps every `step`-th vertex of each ring (rings stay closed). */
export function decimate(land: MultiPolygon, step: number): MultiPolygon {
	const coordinates = land.coordinates.map((poly) =>
		poly
			.map((ring) => {
				if (ring.length <= step * 4) return ring;
				const out = ring.filter((_, i) => i % step === 0);
				out.push(ring[ring.length - 1]!);
				return out;
			})
			.filter((ring) => ring.length >= 4)
	);
	return { type: 'MultiPolygon', coordinates: coordinates.filter((p) => p.length > 0) };
}

export function decimateLines(lines: MultiLineString, step: number): MultiLineString {
	return {
		type: 'MultiLineString',
		coordinates: lines.coordinates.map((line) => {
			if (line.length <= step * 2) return line;
			const out = line.filter((_, i) => i % step === 0);
			if (out[out.length - 1] !== line[line.length - 1]) out.push(line[line.length - 1]!);
			return out;
		})
	};
}

export function prepare(topo: Topology, dots: ArrayBuffer): GlobeData {
	let out!: GlobeData;
	for (const _ of steps(topo, dots, (d) => (out = d)));
	return out;
}

/**
 * The same as `prepare`, in short tasks: it yields to the browser between
 * steps, so turning the geometry into shapes never blocks input for long
 * (Total Blocking Time, PROMPT.md 10).
 */
export async function prepareInSteps(topo: Topology, dots: ArrayBuffer): Promise<GlobeData> {
	let out!: GlobeData;
	for (const _ of steps(topo, dots, (d) => (out = d))) await new Promise((r) => setTimeout(r, 0));
	return out;
}

function* steps(topo: Topology, dots: ArrayBuffer, done: (d: GlobeData) => void): Generator<void> {
	const coll = topo.objects.countries as GeometryCollection;
	const land = merge(topo, coll.geometries as never) as MultiPolygon;
	const farLand = decimate(land, 4);
	yield;
	const borders = mesh(topo, coll, (a, b) => a !== b) as MultiLineString;
	yield;
	const countries = countriesOf(topo);
	const decoded = decodeDots(dots);
	yield;
	const landShape = shapeOf([land]);
	const landFast = shapeOf([decimate(land, 3)]);
	yield;
	const farShape = shapeOf([farLand]);
	const farLandFast = shapeOf([decimate(land, 8)]);
	yield;
	const bordersShape = shapeOf([borders]);
	const bordersFast = shapeOf([decimateLines(borders, 4)]);
	done({
		land,
		farLand,
		borders,
		countries,
		dots: decoded,
		shapes: { land: landShape, landFast, farLand: farShape, farLandFast, borders: bordersShape, bordersFast }
	});
}

export async function loadGlobeData(fetcher: typeof fetch = fetch): Promise<GlobeData> {
	const [topo, dots] = await Promise.all([
		fetcher(OVERVIEW_URL).then((r) => {
			if (!r.ok) throw new Error(`overview geometry: ${r.status}`);
			return r.json() as Promise<Topology>;
		}),
		fetcher(DOTS_URL).then((r) => {
			if (!r.ok) throw new Error(`land dots: ${r.status}`);
			return r.arrayBuffer();
		})
	]);
	return prepareInSteps(topo, dots);
}

export async function loadDetail(fetcher: typeof fetch = fetch): Promise<Map<string, Feature>> {
	const r = await fetcher(DETAIL_URL);
	if (!r.ok) throw new Error(`detail geometry: ${r.status}`);
	return countriesOf((await r.json()) as Topology);
}

export type { Polygon };
