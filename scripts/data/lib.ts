// Shared helpers for the data pipeline (PROMPT.md 8).
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const RAW = join(ROOT, 'data/raw');
export const CURATED = join(ROOT, 'data');
export const OUT = join(ROOT, 'src/lib/data');
export const STATIC = join(ROOT, 'static');
export const REPORTS = join(ROOT, 'reports');

/** Wikimedia asks for a descriptive User-Agent with a contact URL. */
export const USER_AGENT = 'HoistDataBuild/1.0 (+https://github.com/mrghxst/hoist)';

export const TODAY = new Date().toISOString().slice(0, 10);

export function ensureDir(dir: string) {
	mkdirSync(dir, { recursive: true });
}

export function readJson<T>(path: string): T {
	return JSON.parse(readFileSync(path, 'utf8')) as T;
}

export function writeJson(path: string, value: unknown, pretty = true) {
	ensureDir(dirname(path));
	writeFileSync(path, JSON.stringify(value, null, pretty ? '\t' : undefined) + '\n');
}

export function writeText(path: string, text: string) {
	ensureDir(dirname(path));
	writeFileSync(path, text.endsWith('\n') ? text : text + '\n');
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Spaces calls to one per `ms`, as Wikimedia's API etiquette asks. */
export function throttle(ms: number) {
	let last = 0;
	return async () => {
		const wait = last + ms - Date.now();
		if (wait > 0) await sleep(wait);
		last = Date.now();
	};
}

export async function fetchOk(url: string, init?: RequestInit): Promise<Response> {
	for (let attempt = 1; ; attempt++) {
		const res = await fetch(url, {
			...init,
			headers: { 'User-Agent': USER_AGENT, ...(init?.headers ?? {}) }
		});
		if (res.ok) return res;
		if (attempt >= 4 || (res.status < 500 && res.status !== 429)) {
			throw new Error(`${res.status} ${res.statusText} for ${url}`);
		}
		await sleep(2000 * attempt);
	}
}

/** Downloads a file once into data/raw; later runs reuse it. */
export async function download(url: string, file: string): Promise<string> {
	const path = join(RAW, file);
	if (existsSync(path)) return path;
	ensureDir(dirname(path));
	console.log(`  downloading ${url}`);
	const res = await fetchOk(url);
	if (!res.body) throw new Error(`empty body for ${url}`);
	await pipeline(Readable.fromWeb(res.body as never), createWriteStream(path + '.part'));
	const { renameSync } = await import('node:fs');
	renameSync(path + '.part', path);
	return path;
}

export function gzSize(data: string | Uint8Array): number {
	return gzipSync(data, { level: 9 }).length;
}

export function kb(n: number): string {
	return `${(n / 1024).toFixed(1)} KB`;
}

export function fail(message: string): never {
	console.error(`\n✗ ${message}`);
	process.exit(1);
}
