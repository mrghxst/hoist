// Debug: render the sphere renderer's land path to a PNG via resvg.
// node scripts/dev/trace-svg.ts <out.png> <lon> <lat> <zoom> [side]
import { readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { merge } from 'topojson-client';
import type { MultiPolygon } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { frameOf, shapeOf, trace } from '../../src/lib/globe/sphere.ts';

const [out = 'trace.png', lon = '0', lat = '0', zoom = '1', side = '1'] = process.argv.slice(2);
const topo = JSON.parse(readFileSync('static/geo/overview.topo.json', 'utf8')) as Topology;
const coll = topo.objects.countries as GeometryCollection;
const land = merge(topo, coll.geometries as never) as MultiPolygon;
const W = 800;
const r = 200 * Number(zoom);
const f = frameOf(Number(lon), Number(lat), 0, r, W / 2, W / 2);
let d = '';
let cur: [number, number] = [0, 0];
const ctx = {
	moveTo(x: number, y: number) {
		d += `M${x.toFixed(1)} ${y.toFixed(1)}`;
		cur = [x, y];
	},
	lineTo(x: number, y: number) {
		d += `L${x.toFixed(1)} ${y.toFixed(1)}`;
		cur = [x, y];
	},
	arc(cx: number, cy: number, rr: number, a0: number, a1: number, ccw: boolean) {
		const x0 = cx + rr * Math.cos(a0);
		const y0 = cy + rr * Math.sin(a0);
		if (Math.hypot(x0 - cur[0], y0 - cur[1]) > 0.01) d += `L${x0.toFixed(1)} ${y0.toFixed(1)}`;
		// Split into quarter turns so SVG arcs stay unambiguous.
		const sweep = a1 - a0;
		const steps = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 2)));
		for (let i = 1; i <= steps; i++) {
			const a = a0 + (sweep * i) / steps;
			d += `A${rr} ${rr} 0 0 ${ccw ? 0 : 1} ${(cx + rr * Math.cos(a)).toFixed(1)} ${(cy + rr * Math.sin(a)).toFixed(1)}`;
		}
		cur = [cx + rr * Math.cos(a1), cy + rr * Math.sin(a1)];
	},
	closePath() {
		d += 'Z';
	}
} as unknown as CanvasRenderingContext2D;
trace(ctx, shapeOf([land]), f, Number(side) as 1 | -1);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}"><rect width="100%" height="100%" fill="#fff"/><circle cx="${W / 2}" cy="${W / 2}" r="${r}" fill="#eef"/><path d="${d}" fill="#333" fill-rule="evenodd"/></svg>`;
writeFileSync(out, new Resvg(svg).render().asPng());
