/**
 * A fast orthographic renderer for the globe (PROMPT.md 4.3).
 *
 * d3's projection streams re-test every ring with spherical trigonometry on
 * each frame, which cost 15–20 ms per frame here. Instead, every vertex is
 * turned into a unit vector once; per frame a vertex costs a few multiplies.
 * Rings are clipped at the horizon and closed along the rim of the disc.
 *
 * The far side uses the same formula with the visibility test flipped: the
 * unclipped orthographic projection of a back point is exactly where it is
 * seen through the glass.
 */
import type { Feature, Geometry, MultiLineString, MultiPolygon, Polygon, Position } from 'geojson';

/** Rings or lines as unit vectors, flattened. */
export interface Shape {
	xyz: Float32Array;
	/** Start index (in vertices) of each ring; the last entry is the end. */
	starts: Uint32Array;
	/** Per ring: closed polygon ring (1) or open line (0). */
	closed: Uint8Array;
}

export interface Frame {
	vx: number;
	vy: number;
	vz: number;
	ex: number;
	ey: number;
	ux: number;
	uy: number;
	uz: number;
	cg: number;
	sg: number;
	r: number;
	cx: number;
	cy: number;
}

const RAD = Math.PI / 180;

export function frameOf(lon: number, lat: number, roll: number, r: number, cx: number, cy: number): Frame {
	const l = lon * RAD;
	const f = lat * RAD;
	const g = roll * RAD;
	const cl = Math.cos(l);
	const sl = Math.sin(l);
	const cf = Math.cos(f);
	const sf = Math.sin(f);
	return {
		vx: cf * cl,
		vy: cf * sl,
		vz: sf,
		ex: -sl,
		ey: cl,
		ux: -sf * cl,
		uy: -sf * sl,
		uz: cf,
		cg: Math.cos(g),
		sg: Math.sin(g),
		r,
		cx,
		cy
	};
}

function pushRing(out: number[], ring: Position[]) {
	for (const [lon, lat] of ring) {
		const l = lon! * RAD;
		const f = lat! * RAD;
		const cf = Math.cos(f);
		out.push(cf * Math.cos(l), cf * Math.sin(l), Math.sin(f));
	}
}

/** Converts polygons and lines into a Shape. */
export function shapeOf(geometries: (Geometry | Feature | null | undefined)[]): Shape {
	const xyz: number[] = [];
	const starts: number[] = [];
	const closed: number[] = [];
	const add = (ring: Position[], isClosed: boolean) => {
		if (ring.length < 2) return;
		starts.push(xyz.length / 3);
		closed.push(isClosed ? 1 : 0);
		pushRing(xyz, isClosed ? ring.slice(0, -1) : ring);
	};
	const visit = (g: Geometry | Feature | null | undefined) => {
		if (!g) return;
		if (g.type === 'Feature') return visit(g.geometry);
		switch (g.type) {
			case 'Polygon':
				for (const r of (g as Polygon).coordinates) add(r, true);
				break;
			case 'MultiPolygon':
				for (const p of (g as MultiPolygon).coordinates) for (const r of p) add(r, true);
				break;
			case 'LineString':
				add(g.coordinates, false);
				break;
			case 'MultiLineString':
				for (const l of (g as MultiLineString).coordinates) add(l, false);
				break;
			case 'GeometryCollection':
				for (const c of g.geometries) visit(c);
				break;
		}
	};
	for (const g of geometries) visit(g);
	starts.push(xyz.length / 3);
	return { xyz: Float32Array.from(xyz), starts: Uint32Array.from(starts), closed: Uint8Array.from(closed) };
}

/** Graticule lines every 10°, sampled every 2°. */
export function graticuleShape(): Shape {
	const lines: Position[][] = [];
	for (let lon = -180; lon < 180; lon += 10) {
		const line: Position[] = [];
		for (let lat = -80; lat <= 80; lat += 2) line.push([lon, lat]);
		lines.push(line);
	}
	for (let lat = -80; lat <= 80; lat += 10) {
		const line: Position[] = [];
		for (let lon = -180; lon <= 180; lon += 2) line.push([lon, lat]);
		lines.push(line);
	}
	return shapeOf([{ type: 'MultiLineString', coordinates: lines }]);
}

// Scratch buffers, grown as needed and reused every frame (no garbage).
let sx = new Float64Array(1024);
let sy = new Float64Array(1024);
let d = new Float64Array(1024);

/**
 * Adds the visible part of a shape to the current canvas path.
 * `side` 1 draws the front hemisphere, −1 the far side.
 */
export function trace(ctx: CanvasRenderingContext2D | Path2D, shape: Shape, f: Frame, side: 1 | -1 = 1) {
	const { xyz, starts, closed } = shape;
	const { vx, vy, vz, ex, ey, ux, uy, uz, cg, sg, r, cx, cy } = f;
	const rings = starts.length - 1;
	for (let k = 0; k < rings; k++) {
		const s = starts[k]!;
		const e = starts[k + 1]!;
		const n = e - s;
		if (n < 2) continue;
		const isClosed = closed[k] === 1;

		// Screen positions and facing for each vertex.
		if (sx.length < n) {
			sx = new Float64Array(n * 2);
			sy = new Float64Array(n * 2);
			d = new Float64Array(n * 2);
		}
		let anyIn = false;
		let anyOut = false;
		for (let i = 0; i < n; i++) {
			const o = (s + i) * 3;
			const px = xyz[o]!;
			const py = xyz[o + 1]!;
			const pz = xyz[o + 2]!;
			const dd = side * (px * vx + py * vy + pz * vz);
			const a = px * ex + py * ey;
			const b = px * ux + py * uy + pz * uz;
			sx[i] = a * cg - b * sg;
			sy[i] = -(a * sg + b * cg);
			d[i] = dd;
			if (dd > 0) anyIn = true;
			else anyOut = true;
		}
		if (!anyIn) continue;

		if (!anyOut) {
			ctx.moveTo(cx + r * sx[0]!, cy + r * sy[0]!);
			for (let i = 1; i < n; i++) ctx.lineTo(cx + r * sx[i]!, cy + r * sy[i]!);
			if (isClosed) ctx.closePath();
			continue;
		}

		// Crosses the horizon. Point where segment i→j meets it, on the rim.
		const rimPoint = (i: number, j: number): [number, number] => {
			const t = d[i]! / (d[i]! - d[j]!);
			const x = sx[i]! + (sx[j]! - sx[i]!) * t;
			const y = sy[i]! + (sy[j]! - sy[i]!) * t;
			const len = Math.hypot(x, y) || 1;
			return [x / len, y / len];
		};

		if (!isClosed) {
			let drawing = false;
			for (let i = 0; i < n; i++) {
				if (d[i]! > 0) {
					if (!drawing) {
						if (i > 0) {
							const [x, y] = rimPoint(i - 1, i);
							ctx.moveTo(cx + r * x, cy + r * y);
							ctx.lineTo(cx + r * sx[i]!, cy + r * sy[i]!);
						} else ctx.moveTo(cx + r * sx[i]!, cy + r * sy[i]!);
						drawing = true;
					} else ctx.lineTo(cx + r * sx[i]!, cy + r * sy[i]!);
				} else if (drawing) {
					const [x, y] = rimPoint(i - 1, i);
					ctx.lineTo(cx + r * x, cy + r * y);
					drawing = false;
				}
			}
			continue;
		}

		// Closed ring crossing the horizon: cut it into visible pieces, each
		// running from an entry point on the rim to an exit point. They are
		// joined below, after all rings of the shape are cut.
		let start = 0;
		for (let i = 0; i < n; i++) {
			if (d[i]! > 0 && d[(i - 1 + n) % n]! <= 0) {
				start = i;
				break;
			}
		}
		let open = false;
		for (let step = 0; step <= n; step++) {
			const i = (start + step) % n;
			const prev = (start + step - 1 + n) % n;
			if (d[i]! > 0 && step < n) {
				if (!open) {
					const [x, y] = rimPoint(prev, i);
					pieces.begin(Math.atan2(y, x), x, y);
					open = true;
				}
				pieces.add(sx[i]!, sy[i]!);
			} else if (open) {
				const [x, y] = rimPoint(prev, i);
				pieces.end(Math.atan2(y, x), x, y);
				open = false;
			}
		}
	}
	pieces.join(ctx, r, cx, cy, side);
}

/**
 * Visible pieces of clipped rings, joined along the rim the way polygon
 * clippers do (d3's clipRejoin): from each exit, travel round the rim in one
 * direction to the nearest entry, and carry on from there. Rings follow d3's
 * winding, so the direction is fixed; the far side is mirrored.
 */
class Pieces {
	xy = new Float64Array(4096);
	len = 0;
	/** Per piece: first point index, last point index, entry and exit angle. */
	first: number[] = [];
	last: number[] = [];
	tin: number[] = [];
	tout: number[] = [];

	reset() {
		this.len = 0;
		this.first.length = 0;
		this.last.length = 0;
		this.tin.length = 0;
		this.tout.length = 0;
	}

	add(x: number, y: number) {
		if (this.len + 2 > this.xy.length) {
			const grown = new Float64Array(this.xy.length * 2);
			grown.set(this.xy);
			this.xy = grown;
		}
		this.xy[this.len++] = x;
		this.xy[this.len++] = y;
	}

	begin(angle: number, x: number, y: number) {
		this.first.push(this.len / 2);
		this.tin.push(angle);
		this.add(x, y);
	}

	end(angle: number, x: number, y: number) {
		this.add(x, y);
		this.last.push(this.len / 2 - 1);
		this.tout.push(angle);
	}

	join(ctx: CanvasRenderingContext2D | Path2D, r: number, cx: number, cy: number, side: 1 | -1) {
		const m = this.tout.length;
		if (!m) return;
		const dir = side * JOIN_DIRECTION;
		const done = new Uint8Array(m);
		const TAU = Math.PI * 2;
		for (let k0 = 0; k0 < m; k0++) {
			if (done[k0]) continue;
			let k = k0;
			ctx.moveTo(cx + r * this.xy[this.first[k]! * 2]!, cy + r * this.xy[this.first[k]! * 2 + 1]!);
			for (let guard = 0; guard <= m; guard++) {
				done[k] = 1;
				for (let i = this.first[k]! + 1; i <= this.last[k]!; i++) {
					ctx.lineTo(cx + r * this.xy[i * 2]!, cy + r * this.xy[i * 2 + 1]!);
				}
				// The nearest entry round the rim in the join direction.
				const from = this.tout[k]!;
				let next = k0;
				let best = Infinity;
				for (let j = 0; j < m; j++) {
					if (done[j] && j !== k0) continue;
					let gap = dir > 0 ? this.tin[j]! - from : from - this.tin[j]!;
					gap = ((gap % TAU) + TAU) % TAU;
					if (gap < best) {
						best = gap;
						next = j;
					}
				}
				ctx.arc(cx, cy, r, from, from + dir * best, dir < 0);
				if (next === k0) break;
				k = next;
			}
			ctx.closePath();
		}
		this.reset();
	}
}

/** Rim direction for joining (+1 increasing screen angle); see the tests. */
const JOIN_DIRECTION: 1 | -1 = 1;
const pieces = new Pieces();

/** Screen position of a lon/lat, or null when it is on the far side. */
export function project(f: Frame, lon: number, lat: number, minFacing = 0): [number, number] | null {
	const l = lon * RAD;
	const p = lat * RAD;
	const cp = Math.cos(p);
	const px = cp * Math.cos(l);
	const py = cp * Math.sin(l);
	const pz = Math.sin(p);
	if (px * f.vx + py * f.vy + pz * f.vz <= minFacing) return null;
	const a = px * f.ex + py * f.ey;
	const b = px * f.ux + py * f.uy + pz * f.uz;
	return [f.cx + f.r * (a * f.cg - b * f.sg), f.cy - f.r * (a * f.sg + b * f.cg)];
}
