// After `vite build`: preload SvelteKit's root error page in every HTML file.
//
// SvelteKit imports the root error page (`nodes/1`) on every start, but only
// discovers it once its runtime has loaded, so it is the last request before
// the page is interactive and Lighthouse counts it into LCP. A modulepreload
// next to the others fetches it in parallel. SvelteKit 3 has no option for
// this (`output.preloadStrategy` is gone).
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = 'build';
// `vite preview` serves SvelteKit's own copy of the prerendered pages, so
// patch that too: preview and the end-to-end tests then match what ships.
const roots = [root, join('.svelte-kit', 'output', 'prerendered', 'pages')];
const nodes = join(root, '_app', 'immutable', 'nodes');
const errorNode = readdirSync(nodes).find((f) => /^1\.[\w-]+\.js$/.test(f));
if (!errorNode) throw new Error('postbuild: no nodes/1 chunk in build/_app/immutable/nodes');

/**
 * @param {string} dir
 * @returns {Generator<string>}
 */
function* htmlFiles(dir) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) {
			if (entry.name !== '_app') yield* htmlFiles(path);
		} else if (entry.name.endsWith('.html')) yield path;
	}
}

let count = 0;
for (const file of roots.flatMap((r) => [...htmlFiles(r)])) {
	const html = readFileSync(file, 'utf8');
	const start = html.match(/<link href="([^"]*)_app\/immutable\/entry\/start\.[\w-]+\.js" rel="modulepreload">/);
	if (!start || html.includes(`nodes/${errorNode}`)) continue;
	// Same relative prefix as SvelteKit's own links ("./", "../", ...).
	const link = `<link href="${start[1]}_app/immutable/nodes/${errorNode}" rel="modulepreload">`;
	const at = (start.index ?? 0) + start[0].length;
	writeFileSync(file, html.slice(0, at) + '\n\t\t' + link + html.slice(at));
	count++;
}
console.log(`postbuild: preloaded ${relative(root, join(nodes, errorNode))} in ${count} pages`);
