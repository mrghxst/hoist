// A month of daily sessions with a simulated learner who recalls with the
// chance FSRS predicts: prints the daily load and the intervals reached.
// node scripts/dev/simulate.ts [days]
import { readFileSync } from 'node:fs';
import { AGAIN, EASY, GOOD, HARD, type Rating } from '../../src/lib/learn/grade.ts';
import { Learner } from '../../src/lib/learn/learner.ts';
import { Planner } from '../../src/lib/learn/plan.ts';
import { intervalDays, level, recall } from '../../src/lib/learn/scheduler.ts';
import { MemoryStore } from '../../src/lib/learn/store.ts';
import type { GameData } from '../../src/lib/data/types.ts';

const days = Number(process.argv[2] ?? 30);
const data = JSON.parse(readFileSync('src/lib/data/game.json', 'utf8')) as GameData;
const core = data.countries.filter((c) => c.pack === 'core').map((c) => c.id);
const l = new Learner(new MemoryStore());
l.saveSettings = () => {};
const planner = new Planner(data, l);
let seed = 42;
const rand = () => {
	seed = (seed * 1664525 + 1013904223) % 4294967296;
	return seed / 4294967296;
};
const T0 = Date.UTC(2026, 0, 5, 9);
const DAY = 86_400_000;
console.log('day  due  new  asked  again  right%   mastered known learning');
for (let day = 0; day < days; day++) {
	let now = T0 + day * DAY;
	const plan = planner.plan({ mode: 'flag', ids: core, now, random: rand });
	let asked = 0;
	let again = 0;
	for (let item = plan.queue.next(); item; item = plan.queue.next()) {
		now += 8000;
		if (item.study) continue;
		const c = l.card('flag', item.id);
		const p = c ? recall(c, now) : 0.6;
		const r = rand();
		const rating: Rating = r > p ? AGAIN : r < p * 0.3 ? EASY : r > p * 0.9 ? HARD : GOOD;
		l.answer('flag', item.id, rating, now);
		plan.queue.record(item.id, rating);
		asked++;
		if (rating === AGAIN) again++;
	}
	const n = l.counts('flag', core);
	console.log(
		[day + 1, plan.due, plan.fresh, asked, again, Math.round((100 * (asked - again)) / Math.max(1, asked)) + '%', n[3], n[2], n[1]]
			.map((x) => String(x).padStart(5))
			.join(' ')
	);
}
const iv = core.map((id) => l.card('flag', id)).filter((c) => !!c).map(intervalDays).sort((a, b) => a - b);
const q = (p: number) => iv[Math.floor(p * (iv.length - 1))]!.toFixed(1);
console.log(`intervals (days): min ${q(0)}  p25 ${q(0.25)}  median ${q(0.5)}  p75 ${q(0.75)}  max ${q(1)}`);
void level;
