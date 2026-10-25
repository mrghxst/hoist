// Prints the Lighthouse CI results in a few lines: scores, the metrics
// behind the performance score, and the long tasks. Used in CI, where the
// runner is slower than a laptop, so a failure explains itself in the log.
// node scripts/lh-summary.mjs [dir]
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] ?? '.lighthouseci';
if (!existsSync(dir)) {
	console.log(`No ${dir} folder.`);
	process.exit(0);
}
const files = readdirSync(dir).filter((f) => /^lhr-\d+\.json$/.test(f));
for (const f of files) {
	const r = JSON.parse(readFileSync(join(dir, f), 'utf8'));
	const a = r.audits;
	const scores = Object.values(r.categories)
		.map((c) => `${c.id} ${Math.round(c.score * 100)}`)
		.join(', ');
	console.log(`${f}: ${scores} (benchmark index ${r.environment?.benchmarkIndex})`);
	for (const k of ['first-contentful-paint', 'largest-contentful-paint', 'speed-index', 'total-blocking-time', 'cumulative-layout-shift']) {
		console.log(`  ${k.padEnd(26)} ${String(a[k]?.displayValue).padEnd(10)} score ${a[k]?.score}`);
	}
	for (const t of (a['long-tasks']?.details?.items ?? []).slice(0, 8)) {
		console.log(`  long task ${Math.round(t.duration)} ms at ${Math.round(t.startTime)} ms  ${String(t.url).replace(/^.*\/_app\/immutable\//, '')}`);
	}
}
