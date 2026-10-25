// Flags (8.2): Wikimedia Commons files as used in Wikipedia's infoboxes,
// optimised with SVGO, checked visually against the original, saved under
// content-hash names, with a WebP fallback for heavy flags.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { optimize, type Config } from 'svgo';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import type { Flag } from '../../src/lib/data/types.ts';
import { CURATED, RAW, STATIC, ensureDir, fail, fetchOk, readJson, throttle, writeJson } from './lib.ts';

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php';
const BUDGET = 30 * 1024;
const WEBP_WIDTH = 960;
/** Mean per-channel difference (0–255) allowed between original and optimised. */
const MAX_DIFF = 1.5;
const MAX_DIFF_LARGE = 0.3;

const politely = throttle(1000);

interface Sources {
	_comment?: string;
	files: Record<string, string>;
}

interface Meta {
	title: string;
	url: string;
	sha1: string;
	timestamp: string;
	licence: string;
	author: string;
	descriptionurl: string;
}

const SOURCES_PATH = join(CURATED, 'flag-sources.json');

/** English Wikipedia article titles where the common name is not the page. */
const ARTICLE: Record<string, string> = {
	GE: 'Georgia (country)',
	IE: 'Republic of Ireland',
	PS: 'State of Palestine',
	FM: 'Federated States of Micronesia',
	CG: 'Republic of the Congo',
	CD: 'Democratic Republic of the Congo',
	GM: 'The Gambia',
	BS: 'The Bahamas'
};

function stripHtml(s: string): string {
	return s
		.replace(/<[^>]+>/g, '')
		.replace(/&amp;/g, '&')
		.replace(/&quot;/g, '"')
		.replace(/&#039;/g, "'")
		.replace(/\s+/g, ' ')
		.trim();
}

/** Reads `image_flag` from each country's Wikipedia infobox (first run only). */
export async function discoverSources(countries: { id: string; name: string; common: string }[]) {
	const sources: Sources = existsSync(SOURCES_PATH) ? readJson<Sources>(SOURCES_PATH) : { files: {} };
	for (const c of countries) {
		if (sources.files[c.id]) continue;
		await politely();
		const page = ARTICLE[c.id] ?? c.common;
		const url = `${WIKIPEDIA_API}?action=parse&page=${encodeURIComponent(page)}&prop=wikitext&section=0&redirects=1&format=json&formatversion=2`;
		const json = (await (await fetchOk(url)).json()) as { parse?: { wikitext: string } };
		const text = json.parse?.wikitext ?? '';
		const m = /\|\s*image_flag\s*=\s*(?:\[\[)?(?:File:|Image:)?([^\n|\]{}<]+\.svg)/i.exec(text);
		if (m?.[1]) {
			sources.files[c.id] = m[1].trim().replace(/_/g, ' ');
			console.log(`  ${c.id} ${sources.files[c.id]}`);
		} else {
			console.warn(`  ${c.id}: no image_flag in "${page}", add it to data/flag-sources.json`);
		}
	}
	sources._comment =
		'Country → Wikimedia Commons file, as used in the English Wikipedia infobox (image_flag), read on first run and reviewed by hand (PROMPT.md 8.2).';
	const ordered: Sources = { _comment: sources._comment, files: {} };
	for (const k of Object.keys(sources.files).sort()) ordered.files[k] = sources.files[k]!;
	writeJson(SOURCES_PATH, ordered);
}

async function commonsMeta(titles: string[]): Promise<Map<string, Meta>> {
	const out = new Map<string, Meta>();
	for (let i = 0; i < titles.length; i += 50) {
		const batch = titles.slice(i, i + 50);
		await politely();
		const params = new URLSearchParams({
			action: 'query',
			titles: batch.map((t) => `File:${t}`).join('|'),
			prop: 'imageinfo',
			iiprop: 'url|size|sha1|timestamp|extmetadata',
			iiextmetadatafilter: 'LicenseShortName|Artist|Credit',
			redirects: '1',
			format: 'json',
			formatversion: '2'
		});
		const json = (await (await fetchOk(`${COMMONS_API}?${params}`)).json()) as {
			query: {
				normalized?: { from: string; to: string }[];
				redirects?: { from: string; to: string }[];
				pages: {
					title: string;
					missing?: boolean;
					imageinfo?: {
						url: string;
						sha1: string;
						timestamp: string;
						descriptionurl: string;
						extmetadata?: Record<string, { value: string }>;
					}[];
				}[];
			};
		};
		const q = json.query;
		const resolve = (t: string) => {
			let x = t;
			for (const n of q.normalized ?? []) if (n.from === x) x = n.to;
			for (const r of q.redirects ?? []) if (r.from === x) x = r.to;
			return x;
		};
		for (const t of batch) {
			const final = resolve(`File:${t}`);
			const page = q.pages.find((p) => p.title === final);
			const info = page?.imageinfo?.[0];
			if (!page || page.missing || !info) continue;
			const em = info.extmetadata ?? {};
			out.set(t, {
				title: page.title.replace(/^File:/, ''),
				url: info.url,
				sha1: info.sha1,
				timestamp: info.timestamp,
				licence: stripHtml(em.LicenseShortName?.value ?? 'unknown'),
				author: stripHtml(em.Artist?.value ?? 'unknown'),
				descriptionurl: info.descriptionurl
			});
		}
	}
	return out;
}

/** SVGO at a given number precision; lower is smaller and less exact. */
function svgoAt(precision: number): Config {
	return {
		multipass: true,
		floatPrecision: precision,
		plugins: [
			{
				name: 'preset-default',
				params: {
					overrides: {
						cleanupIds: { minify: true },
						convertPathData: { floatPrecision: precision },
						cleanupNumericValues: { floatPrecision: precision }
					}
				}
			},
			'sortAttrs'
		]
	};
}

const SVGO_SAFE: Config = {
	multipass: false,
	plugins: [
		{
			name: 'preset-default',
			params: {
				overrides: {
					convertPathData: false,
					convertShapeToPath: false,
					mergePaths: false,
					convertTransform: false,
					inlineStyles: false,
					minifyStyles: false
				}
			}
		}
	]
};

function render(svg: string, width: number): Uint8Array {
	const r = new Resvg(svg, { fitTo: { mode: 'width', value: width }, background: 'rgba(255,255,255,1)' });
	return r.render().pixels;
}

function meanDiff(a: Uint8Array, b: Uint8Array): number {
	if (a.length !== b.length) return 255;
	let sum = 0;
	for (let i = 0; i < a.length; i++) sum += Math.abs(a[i]! - b[i]!);
	return sum / a.length;
}

/** viewBox [w, h], adding one from width/height when missing. */
function ensureViewBox(svg: string): { svg: string; w: number; h: number } {
	// True proportions come from the viewBox, unless the file stretches it
	// with preserveAspectRatio="none" (Qatar); then width/height decide.
	const root = /<svg\b[^>]*>/is.exec(svg)?.[0] ?? '';
	const vb = /viewBox\s*=\s*["']\s*([-\d.e]+)[\s,]+([-\d.e]+)[\s,]+([-\d.e]+)[\s,]+([-\d.e]+)\s*["']/i.exec(root);
	const w = Number(/\swidth\s*=\s*["']([\d.e+]+)(?:px)?["']/i.exec(root)?.[1]);
	const h = Number(/\sheight\s*=\s*["']([\d.e+]+)(?:px)?["']/i.exec(root)?.[1]);
	const stretched = /preserveAspectRatio\s*=\s*["']none["']/i.test(root);
	if (vb && !(stretched && w && h)) return { svg, w: Number(vb[3]), h: Number(vb[4]) };
	if (!w || !h) throw new Error('SVG has neither viewBox nor width/height');
	return { svg: vb ? svg : svg.replace(/<svg\b/i, `<svg viewBox="0 0 ${w} ${h}"`), w, h };
}

const hash = (data: string | Buffer, n = 12) => createHash('sha256').update(data).digest('hex').slice(0, n);

export interface FlagBuild {
	flags: Record<string, Flag>;
	/** Optimised SVG text per country, for the lookalike step. */
	svgs: Map<string, string>;
	warnings: string[];
	total: number;
}

export async function buildFlags(ids: string[]): Promise<FlagBuild> {
	if (!existsSync(SOURCES_PATH)) fail('data/flag-sources.json is missing; run `pnpm data --discover`');
	const sources = readJson<Sources>(SOURCES_PATH).files;
	const missing = ids.filter((id) => !sources[id]);
	if (missing.length) fail(`no Commons file for ${missing.join(', ')} in data/flag-sources.json`);

	const meta = await commonsMeta(ids.map((id) => sources[id]!));
	const cache = join(RAW, 'flags');
	ensureDir(cache);
	const outDir = join(STATIC, 'flags');
	ensureDir(outDir);

	const flags: Record<string, Flag> = {};
	const svgs = new Map<string, string>();
	const warnings: string[] = [];
	const written = new Set<string>();
	let total = 0;

	for (const id of ids) {
		const m = meta.get(sources[id]!);
		if (!m) fail(`${id}: Commons has no file "${sources[id]}"`);
		const rawPath = join(cache, `${m.sha1}.svg`);
		if (!existsSync(rawPath)) {
			await politely();
			const res = await fetchOk(m.url);
			const buf = Buffer.from(await res.arrayBuffer());
			const sha1 = createHash('sha1').update(buf).digest('hex');
			if (sha1 !== m.sha1) fail(`${id}: SHA-1 mismatch for ${m.url}`);
			writeFileSync(rawPath, buf);
		}
		const original = ensureViewBox(readFileSync(rawPath, 'utf8'));

		// Optimise as far as it still looks the same: the lowest precision whose
		// render matches the original, at a small and a large size.
		const small = render(original.svg, 160);
		const large = render(original.svg, 480);
		const same = (candidate: string) =>
			meanDiff(small, render(candidate, 160)) <= MAX_DIFF && meanDiff(large, render(candidate, 480)) <= MAX_DIFF_LARGE;
		let svg: string | undefined;
		for (const precision of [1, 2, 3]) {
			const candidate = optimize(original.svg, svgoAt(precision)).data;
			if (same(candidate)) {
				svg = candidate;
				break;
			}
		}
		if (!svg) {
			const safe = optimize(original.svg, SVGO_SAFE).data;
			if (same(safe)) {
				svg = safe;
				warnings.push(`${id}: full SVGO changed the image, used the safe preset`);
			} else {
				svg = original.svg;
				warnings.push(`${id}: SVGO changed the image, shipped the original`);
			}
		}

		const name = `${hash(svg)}.svg`;
		writeFileSync(join(outDir, name), svg);
		written.add(name);
		const bytes = Buffer.byteLength(svg);
		total += bytes;

		const flag: Flag = {
			svg: `/flags/${name}`,
			ratio: Math.round((original.w / original.h) * 10000) / 10000,
			bytes,
			licence: m.licence,
			author: m.author,
			source: m.descriptionurl,
			revised: m.timestamp,
			sha1: m.sha1
		};

		if (bytes > BUDGET) {
			const webp = await sharp(Buffer.from(svg), { density: 300 })
				.resize({ width: WEBP_WIDTH })
				.webp({ quality: 72, effort: 6, smartSubsample: true })
				.toBuffer();
			const wname = `${hash(webp)}.webp`;
			writeFileSync(join(outDir, wname), webp);
			written.add(wname);
			flag.webp = `/flags/${wname}`;
			total += webp.length;
		}

		flags[id] = flag;
		svgs.set(id, svg);
	}

	// Remove files from earlier runs that nothing points to any more.
	for (const f of readdirSync(outDir)) if (!written.has(f)) rmSync(join(outDir, f));

	return { flags, svgs, warnings, total };
}
