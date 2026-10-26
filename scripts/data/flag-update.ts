// The weekly flag check (PROMPT.md 8.2), run by .github/workflows/flags.yml.
//   node scripts/data/flag-update.ts check     flags whose Commons file changed since the last `pnpm data`
//   node scripts/data/flag-update.ts preview   after `pnpm data`: each changed flag before and after,
//                                              as reports/flag-update.png and the pull request text
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp, { type OverlayOptions } from 'sharp';
import type { Country, Flag } from '../../src/lib/data/types.ts';
import { commonsMeta } from './flags.ts';
import { CURATED, OUT, REPORTS, STATIC, fail, readJson, writeText } from './lib.ts';

const REPO = 'mrghxst/hoist';
const BRANCH = process.env.FLAG_BRANCH ?? 'flag-update';

const names = new Map(readJson<Country[]>(join(OUT, 'countries.json')).map((c) => [c.id, c.name]));
const label = (id: string) => `${names.get(id) ?? id} (${id})`;

/** A value for later workflow steps. */
function output(key: string, value: string) {
	if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
}

async function check() {
	const sources = readJson<{ files: Record<string, string> }>(join(CURATED, 'flag-sources.json')).files;
	const flags = readJson<Record<string, Flag>>(join(OUT, 'flags.json'));
	const ids = Object.keys(flags).sort();
	const meta = await commonsMeta(ids.map((id) => sources[id]!));
	const changed = ids.filter((id) => meta.get(sources[id]!)?.sha1 !== flags[id]!.sha1);
	console.log(changed.length ? `Changed on Commons: ${changed.map(label).join(', ')}` : `All ${ids.length} flags match Commons.`);
	output('changed', changed.join(' '));
}

const CELL_W = 300;
const FLAG_H = 120;
const ROW_H = FLAG_H + 48;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

async function png(svg: Buffer, ratio: number) {
	const w = Math.min(CELL_W - 40, Math.round(FLAG_H * ratio));
	const h = Math.round(w / ratio);
	return { input: await sharp(svg, { density: 150 }).resize(w, h, { fit: 'fill' }).png().toBuffer(), w, h };
}

async function preview() {
	const before = JSON.parse(execFileSync('git', ['show', 'HEAD:src/lib/data/flags.json'], { encoding: 'utf8' })) as Record<string, Flag>;
	const after = readJson<Record<string, Flag>>(join(OUT, 'flags.json'));
	const changed = Object.keys(after)
		.filter((id) => before[id]?.svg !== after[id]!.svg)
		.sort();
	if (!changed.length) fail('no flag changed; nothing to preview');

	// One row per flag: the name, the flag now, the flag after the update.
	const parts: OverlayOptions[] = [];
	const text = (s: string, x: number, y: number, size = 14) =>
		Buffer.from(`<svg width="${CELL_W}" height="24"><text x="${CELL_W / 2}" y="17" font-family="sans-serif" font-size="${size}" text-anchor="middle">${esc(s)}</text></svg>`);
	parts.push({ input: text('Now', 0, 0), left: CELL_W, top: 8 }, { input: text('After this update', 0, 0), left: CELL_W * 2, top: 8 });
	for (const [i, id] of changed.entries()) {
		const top = 40 + i * ROW_H;
		parts.push({ input: text(label(id), 0, 0), left: 0, top: top + FLAG_H / 2 - 12 });
		const old = before[id] ? execFileSync('git', ['show', `HEAD:static${before[id].svg}`]) : null;
		for (const [col, svg, ratio] of [
			[1, old, before[id]?.ratio ?? 1],
			[2, readFileSync(join(STATIC, after[id]!.svg)), after[id]!.ratio]
		] as const) {
			if (!svg) continue;
			const p = await png(svg, ratio);
			parts.push({ input: p.input, left: col * CELL_W + (CELL_W - p.w) / 2, top: top + (FLAG_H - p.h) / 2 });
		}
	}
	await sharp({ create: { width: CELL_W * 3, height: 40 + changed.length * ROW_H, channels: 3, background: '#f2f2f2' } })
		.composite(parts)
		.png()
		.toFile(join(REPORTS, 'flag-update.png'));

	const rows = changed.map((id) => {
		const f = after[id]!;
		return `| ${label(id)} | [${decodeURIComponent(f.source.split('File:')[1] ?? f.source).replace(/_/g, ' ')}](${f.source}) | ${f.revised.slice(0, 10)} | ${f.licence} | ${f.author} |`;
	});
	writeText(
		join(REPORTS, 'flag-update.md'),
		[
			`The weekly check found ${changed.length === 1 ? 'one flag' : `${changed.length} flags`} that changed on Wikimedia Commons. Please look at each one before merging: a new upload is not always a better one.`,
			'',
			`![Each changed flag now and after this update](https://github.com/${REPO}/raw/${BRANCH}/reports/flag-update.png)`,
			'',
			'| Country | Commons file | Revised | Licence | Author |',
			'|---|---|---|---|---|',
			...rows,
			'',
			'Made by `.github/workflows/flags.yml` with `pnpm data`. If a change is wrong, close this pull request; `data/flag-sources.json` can point the country at another Commons file.'
		].join('\n') + '\n'
	);
	console.log(`Preview of ${changed.length} flags: reports/flag-update.png, reports/flag-update.md`);
}

const mode = process.argv[2];
if (mode === 'check') await check();
else if (mode === 'preview') await preview();
else fail('usage: node scripts/data/flag-update.ts check | preview');
