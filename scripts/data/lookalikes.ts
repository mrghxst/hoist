// Lookalike candidates (8.6) and dominant flag colours.
// Each flag is rasterised to 64×40 (ignoring true proportions), converted to
// Lab, and compared by colour histogram plus a coarse 8×5 layout.
import sharp from 'sharp';

const W = 64;
const H = 40;
const GX = 8;
const GY = 5;

type Lab = [number, number, number];

export interface Signature {
	cells: Lab[];
	hist: Float32Array;
	colours: string[];
}

function toLinear(c: number): number {
	const s = c / 255;
	return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function rgbToLab(r: number, g: number, b: number): Lab {
	const R = toLinear(r);
	const G = toLinear(g);
	const B = toLinear(b);
	const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
	const y = R * 0.2126 + G * 0.7152 + B * 0.0722;
	const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
	const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (841 / 108) * t + 4 / 29);
	const fx = f(x);
	const fy = f(y);
	const fz = f(z);
	return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

const dE = (a: Lab, b: Lab) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// Named reference colours for the dominant-colour summary.
const NAMED: [string, Lab][] = (
	[
		['red', [206, 17, 38]],
		['white', [255, 255, 255]],
		['blue', [0, 56, 168]],
		['lightblue', [117, 170, 219]],
		['green', [0, 122, 61]],
		['yellow', [252, 209, 22]],
		['black', [0, 0, 0]],
		['orange', [255, 130, 0]],
		['maroon', [128, 0, 32]]
	] as [string, [number, number, number]][]
).map(([n, [r, g, b]]) => [n, rgbToLab(r, g, b)]);

// Histogram bins: L in 4, a and b in 6 each.
const binOf = ([l, a, b]: Lab) => {
	const li = Math.min(3, Math.max(0, Math.floor(l / 25)));
	const ai = Math.min(5, Math.max(0, Math.floor((a + 90) / 30)));
	const bi = Math.min(5, Math.max(0, Math.floor((b + 90) / 30)));
	return li * 36 + ai * 6 + bi;
};

export async function signature(svg: string): Promise<Signature> {
	const { data } = await sharp(Buffer.from(svg), { density: 72 })
		.flatten({ background: '#ffffff' })
		.resize(W, H, { fit: 'fill' })
		.removeAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });

	const labs: Lab[] = [];
	for (let i = 0; i < W * H; i++) labs.push(rgbToLab(data[i * 3]!, data[i * 3 + 1]!, data[i * 3 + 2]!));

	const cells: Lab[] = [];
	const cw = W / GX;
	const ch = H / GY;
	for (let gy = 0; gy < GY; gy++) {
		for (let gx = 0; gx < GX; gx++) {
			const sum: Lab = [0, 0, 0];
			for (let y = gy * ch; y < (gy + 1) * ch; y++) {
				for (let x = gx * cw; x < (gx + 1) * cw; x++) {
					const p = labs[y * W + x]!;
					sum[0] += p[0];
					sum[1] += p[1];
					sum[2] += p[2];
				}
			}
			const n = cw * ch;
			cells.push([sum[0] / n, sum[1] / n, sum[2] / n]);
		}
	}

	const hist = new Float32Array(4 * 36);
	const named = new Map<string, number>();
	for (const p of labs) {
		hist[binOf(p)]! += 1 / labs.length;
		let best = NAMED[0]!;
		for (const n of NAMED) if (dE(p, n[1]) < dE(p, best[1])) best = n;
		named.set(best[0], (named.get(best[0]) ?? 0) + 1 / labs.length);
	}
	const colours = [...named.entries()]
		.filter(([, share]) => share >= 0.08)
		.sort((a, b) => b[1] - a[1])
		.map(([n]) => n);

	return { cells, hist, colours };
}

export function distance(a: Signature, b: Signature): number {
	let layout = 0;
	for (let i = 0; i < a.cells.length; i++) layout += dE(a.cells[i]!, b.cells[i]!);
	layout /= a.cells.length * 100;
	let inter = 0;
	for (let i = 0; i < a.hist.length; i++) inter += Math.min(a.hist[i]!, b.hist[i]!);
	return 0.6 * layout + 0.4 * (1 - inter);
}

export interface PairReport {
	pairs: { a: string; b: string; d: number; curated: boolean }[];
	groupWidth: number;
	groups: { id: string; width: number }[];
}

export function comparePairs(
	sigs: Map<string, Signature>,
	groups: { id: string; members: string[] }[],
	limit = 60
): PairReport {
	const ids = [...sigs.keys()];
	const inGroup = (a: string, b: string) => groups.some((g) => g.members.includes(a) && g.members.includes(b));
	const all: { a: string; b: string; d: number; curated: boolean }[] = [];
	for (let i = 0; i < ids.length; i++) {
		for (let j = i + 1; j < ids.length; j++) {
			const a = ids[i]!;
			const b = ids[j]!;
			all.push({ a, b, d: distance(sigs.get(a)!, sigs.get(b)!), curated: inGroup(a, b) });
		}
	}
	all.sort((x, y) => x.d - y.d);

	const groupStats = groups.map((g) => {
		let width = 0;
		for (const a of g.members) {
			for (const b of g.members) {
				if (a < b && sigs.has(a) && sigs.has(b)) width = Math.max(width, distance(sigs.get(a)!, sigs.get(b)!));
			}
		}
		return { id: g.id, width };
	});
	const groupWidth = Math.max(0, ...groupStats.map((g) => g.width));
	const pairs = all.filter((p, i) => i < limit || (p.d <= groupWidth && !p.curated && i < 400));
	return { pairs, groupWidth, groups: groupStats };
}
