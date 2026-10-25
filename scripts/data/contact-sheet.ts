// Renders every flag into one labelled PNG for review: reports/flags.png.
// `node scripts/data/contact-sheet.ts [IDS...]`
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp, { type OverlayOptions } from 'sharp';
import type { Country, Flag } from '../../src/lib/data/types.ts';
import { OUT, REPORTS, STATIC, readJson } from './lib.ts';

const countries = readJson<Country[]>(join(OUT, 'countries.json'));
const flags = readJson<Record<string, Flag>>(join(OUT, 'flags.json'));
const only = process.argv.slice(2);
const list = only.length ? countries.filter((c) => only.includes(c.id)) : countries;

const CELL_W = 150;
const CELL_H = 110;
const FLAG_H = 70;
const COLS = only.length ? Math.min(only.length, 8) : 14;
const rows = Math.ceil(list.length / COLS);

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const parts: OverlayOptions[] = [];
for (const [i, c] of list.entries()) {
	const f = flags[c.id]!;
	const x = (i % COLS) * CELL_W;
	const y = Math.floor(i / COLS) * CELL_H;
	const w = Math.min(CELL_W - 16, Math.round(FLAG_H * f.ratio));
	const h = Math.round(w / f.ratio);
	const png = await sharp(readFileSync(join(STATIC, f.svg)), { density: 150 }).resize(w, h, { fit: 'fill' }).png().toBuffer();
	parts.push({ input: png, left: x + Math.round((CELL_W - w) / 2), top: y + 8 + (FLAG_H - h) });
	const label = Buffer.from(
		`<svg width="${CELL_W}" height="24"><text x="${CELL_W / 2}" y="16" font-family="sans-serif" font-size="12" text-anchor="middle">${esc(`${c.id} ${c.name}`.slice(0, 24))}</text></svg>`
	);
	parts.push({ input: label, left: x, top: y + FLAG_H + 14 });
}

await sharp({ create: { width: COLS * CELL_W, height: rows * CELL_H, channels: 3, background: '#eeeeee' } })
	.composite(parts)
	.png()
	.toFile(join(REPORTS, only.length ? 'flags-subset.png' : 'flags.png'));
console.log(`wrote ${list.length} flags`);
