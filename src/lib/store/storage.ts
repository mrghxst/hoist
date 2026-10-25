/**
 * Safe access to the one localStorage key. Every read and write is wrapped,
 * so private mode or blocked storage never breaks the app (PROMPT.md 3.4).
 * The full progress store builds on this in M4.
 */
export const STORAGE_KEY = 'hoist:v1';

let available: boolean | undefined;

export function storageAvailable(): boolean {
	if (available !== undefined) return available;
	try {
		const probe = '__hoist_probe__';
		localStorage.setItem(probe, '1');
		localStorage.removeItem(probe);
		available = true;
	} catch {
		available = false;
	}
	return available;
}

export function readRaw(): Record<string, unknown> {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return {};
		const parsed: unknown = JSON.parse(raw);
		return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
	} catch {
		return {};
	}
}

export function writeRaw(value: Record<string, unknown>): boolean {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
		return true;
	} catch {
		return false;
	}
}

export function readSettings(): Record<string, unknown> {
	const s = readRaw().settings;
	return s && typeof s === 'object' ? (s as Record<string, unknown>) : {};
}

export function writeSettings(patch: Record<string, unknown>): boolean {
	const all = readRaw();
	all.settings = { ...readSettings(), ...patch };
	return writeRaw(all);
}
