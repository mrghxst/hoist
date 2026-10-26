/**
 * Play's first flag (owner, M8). Play opens on a run of random flags, so its
 * first flag is not known at build time. An inline script right after the
 * image picks the run and shows that flag before any app JavaScript loads,
 * so the flag is still the first paint (PROMPT.md 10). It goes in at
 * prerender (`hooks.server.ts`), at the end of `<body>`, outside the app's
 * root: a node among the app's own would fail hydration, and rendering it
 * from the page would need Svelte's `{@html}`, which costs every page's
 * shared JavaScript. The list holds file names and ratios only: no names.
 */
import { statSync } from 'node:fs';
import game from '#lib/data/game.json';
import type { GameData } from '#lib/data/types.ts';
import { runOrder } from '#lib/play/run.ts';

const MARK = 'id="first-flag"';
/** A first flag at most this big (most are; see `firstFlagScript`). */
const LIGHT = 4096;
let tag: string | undefined;

function script(): string {
	const flags = (game as unknown as GameData).countries
		.filter((c) => c.pack === 'core')
		.map((c): [string, number, 0 | 1] => [
			c.flag.slice('/flags/'.length),
			Math.round(c.ratio * 10000) / 10000,
			statSync(`static${c.flag}`).size <= LIGHT ? 1 : 0
		]);
	return `<script>${firstFlagScript(flags, { w: 320, h: 200 })}</script>`;
}

/** The page with the script before `</body>`, if it has the first-flag image. */
export function withFirstFlag(html: string): string {
	const end = html.lastIndexOf('</body>');
	if (end < 0 || !html.includes(MARK)) return html;
	return html.slice(0, end) + (tag ??= script()) + html.slice(end);
}

/**
 * An inline script for the prerendered page: picks the run's seed (from the
 * address, or at random) and shows its first flag at once, before the app's
 * JavaScript loads, so the flag is the first paint (PROMPT.md 10). The app
 * reads `window.__hoistRun` and plays the same run. The flag list holds file
 * names and ratios only, in pool order: no country names (the answer never
 * leaks). The size and box match `FlagImage`.
 *
 * A random seed is drawn again until the first flag is a light file (`1`
 * in the list): most flags are under 4 KB, a few with coats of arms are
 * up to 150 KB, and the first one decides how soon the page has painted.
 * Only the opening flag of the first run is held to that; a challenge
 * link keeps its seed.
 */
export function firstFlagScript(flags: [file: string, ratio: number, light: 0 | 1][], box: { w: number; h: number }): string {
	return `(function(){try{var L=${JSON.stringify(flags)},q=new URLSearchParams(location.search);if(q.get('deck'))return;var o=${runOrder.toString()},t=q.get('seed'),s=t&&/^[0-9a-z]{1,7}$/.test(t)?parseInt(t,36):NaN,f;if(s>=0&&s<=4294967295)f=L[o(L.length,s)[0]];else for(var k=0;k<50&&!(f&&f[2]);k++){s=Math.random()*4294967296>>>0;f=L[o(L.length,s)[0]]}var r=f[1],w=Math.min(${box.w},${box.h}*r),i=document.getElementById('first-flag');i.width=Math.round(w);i.height=Math.round(w/r);i.style.setProperty('--r',r);i.style.aspectRatio=r;i.src='/flags/'+f[0];window.__hoistRun={seed:s}}catch(e){}})()`;
}
