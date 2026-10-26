/**
 * Open Graph images (PROMPT.md 4.4): 1200×630 PNGs made at build time with
 * resvg. Each flag page gets the flag, a small globe showing where it is,
 * and its name; the site gets a grid of well-known flags.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { BRAND, DOMAIN, TAGLINE } from '#lib/brand.ts';
import type { Country, Flag } from '#lib/data/types.ts';
import { NOT_RECTANGULAR } from '#lib/flags.ts';

const W = 1200;
const H = 630;
const FONTS = join('node_modules', 'geist', 'dist', 'fonts', 'geist-sans');

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A file from `static/` as a data URI, for <image>. */
function embed(path: string): string {
	const file = readFileSync(join('static', path));
	const type = path.endsWith('.svg') ? 'image/svg+xml' : path.endsWith('.png') ? 'image/png' : 'image/webp';
	return `data:${type};base64,${file.toString('base64')}`;
}

/** Splits a name into at most `lines` lines of about `max` characters. */
export function wrap(text: string, max: number, lines = 2): string[] {
	const out: string[] = [];
	for (const word of text.split(' ')) {
		const last = out[out.length - 1];
		if (last !== undefined && (last + ' ' + word).length <= max) out[out.length - 1] = `${last} ${word}`;
		else out.push(word);
	}
	if (out.length > lines) return [...out.slice(0, lines - 1), out.slice(lines - 1).join(' ')];
	return out;
}

function render(svg: string): Uint8Array<ArrayBuffer> {
	const resvg = new Resvg(svg, {
		fitTo: { mode: 'width', value: W },
		font: {
			fontFiles: [join(FONTS, 'Geist-Regular.ttf'), join(FONTS, 'Geist-SemiBold.ttf')],
			loadSystemFonts: false,
			defaultFontFamily: 'Geist'
		}
	});
	return new Uint8Array(resvg.render().asPng());
}

const frame = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
	<defs>
		<radialGradient id="glow" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#000" stop-opacity="0.05"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
	</defs>
	<rect width="${W}" height="${H}" fill="#fff"/>
	<rect width="${W}" height="${H}" fill="url(#glow)"/>
	${body}
	<text x="80" y="${H - 56}" font-family="Geist" font-weight="600" font-size="30" fill="#000">${BRAND}</text>
	<text x="${W - 80}" y="${H - 56}" font-family="Geist" font-size="26" fill="#666" text-anchor="end">${DOMAIN}</text>
</svg>`;

/** The OG image of one flag page. */
export function flagImage(c: Country, flag: Flag): Uint8Array<ArrayBuffer> {
	// The flag fits a 600×360 box on the left, at its true proportions, with
	// a hairline so white flags read on white (not around Nepal's pennants).
	const box = { x: 80, y: 90, w: 600, h: 360 };
	const fw = Math.min(box.w, box.h * flag.ratio);
	const fh = fw / flag.ratio;
	const fx = box.x + (box.w - fw) / 2;
	const fy = box.y + (box.h - fh) / 2;
	const lines = wrap(c.name, 16);
	const size = lines.some((l) => l.length > 13) ? 44 : 56;
	const nameY = 420 - (lines.length - 1) * size;
	const name = lines
		.map((l, i) => `<text x="760" y="${nameY + i * (size + 4)}" font-family="Geist" font-weight="600" font-size="${size}" fill="#000" letter-spacing="-1">${escape(l)}</text>`)
		.join('');
	return render(
		frame(`
	<image href="${embed(flag.svg)}" x="${fx}" y="${fy}" width="${fw}" height="${fh}" preserveAspectRatio="none"/>
	${NOT_RECTANGULAR[c.id] ? '' : `<rect x="${fx - 0.5}" y="${fy - 0.5}" width="${fw + 1}" height="${fh + 1}" fill="none" stroke="#000" stroke-opacity="0.12"/>`}
	<image href="${embed(`globes/${c.slug}-light.svg`)}" x="760" y="70" width="240" height="240"/>
	${name}
	<text x="760" y="${nameY + lines.length * (size + 4) + 4}" font-family="Geist" font-size="26" fill="#666">Capital: ${escape(c.capital.name)}</text>`)
	);
}

/** The site's OG image: a grid of well-known flags and the tagline. */
export function siteImage(flags: { svg: string; ratio: number }[]): Uint8Array<ArrayBuffer> {
	const cols = 4;
	const cell = { w: 120, h: 80, gap: 18 };
	const grid = flags
		.slice(0, 12)
		.map((f, i) => {
			const x = 80 + (i % cols) * (cell.w + cell.gap);
			const y = 120 + Math.floor(i / cols) * (cell.h + cell.gap);
			const w = Math.min(cell.w, cell.h * f.ratio);
			const h = w / f.ratio;
			const fx = x + (cell.w - w) / 2;
			const fy = y + (cell.h - h) / 2;
			return `<image href="${embed(f.svg)}" x="${fx}" y="${fy}" width="${w}" height="${h}" preserveAspectRatio="none"/><rect x="${fx - 0.5}" y="${fy - 0.5}" width="${w + 1}" height="${h + 1}" fill="none" stroke="#000" stroke-opacity="0.12"/>`;
		})
		.join('');
	const tagline = wrap(TAGLINE, 18)
		.map((l, i) => `<text x="905" y="${240 + i * 56}" font-family="Geist" font-weight="600" font-size="46" fill="#000" letter-spacing="-1" text-anchor="middle">${escape(l)}</text>`)
		.join('');
	return render(
		frame(`${grid}
	${tagline}
	<text x="905" y="${240 + 2 * 56 + 6}" font-family="Geist" font-size="24" fill="#666" text-anchor="middle">Type the country. Watch the globe fly.</text>`)
	);
}
