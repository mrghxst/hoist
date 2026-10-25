// Bundle-size budget (PROMPT.md 10): the play page's initial JavaScript,
// gzipped, must stay at or under 75 KB. Reads the prerendered index.html and
// sums every script it loads or modulepreloads.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUILD = 'build';
const BUDGET_JS = 75 * 1024;

const html = readFileSync(join(BUILD, 'index.html'), 'utf8');
const urls = new Set();
for (const m of html.matchAll(/(?:href|src)="([^"]+\.js)"/g)) urls.add(m[1]);
for (const m of html.matchAll(/import\("([^"]+\.js)"\)/g)) urls.add(m[1]);

let total = 0;
for (const u of urls) {
	const file = join(BUILD, u.replace(/^\.?\//, ''));
	if (!existsSync(file)) continue;
	total += gzipSync(readFileSync(file), { level: 9 }).length;
}

/** @param {number} n */
const kb = (n) => (n / 1024).toFixed(1) + ' KB';
console.log(`Play page initial JS: ${kb(total)} gzipped (${urls.size} files, budget ${kb(BUDGET_JS)})`);
if (total > BUDGET_JS) {
	console.error('Over budget.');
	process.exit(1);
}
