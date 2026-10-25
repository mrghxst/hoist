/**
 * Where progress is kept (PROMPT.md 3.4). The app talks to `ProgressStore`
 * only, so a cloud sync could be added behind it later.
 */
import { readRaw, storageAvailable, writeRaw } from '#lib/store/storage.ts';
import { migrate } from './schema.ts';
import type { Progress } from './types.ts';

export interface ProgressStore {
	/** False when nothing will outlive the tab (private mode, blocked, or
	 *  saved by a newer Hoist). */
	readonly persistent: boolean;
	load(): Progress;
	/** Saves everything but the settings, which are saved on their own
	 *  (`writeSettings`), so a stale copy here never undoes a change made
	 *  meanwhile, such as the theme toggle. */
	save(progress: Progress): boolean;
}

/** `localStorage`, under the one `hoist:v1` key. */
export class LocalStore implements ProgressStore {
	persistent: boolean;
	private readOnly = false;

	constructor() {
		this.persistent = storageAvailable();
	}

	load(): Progress {
		const m = migrate(readRaw());
		if (!m.ok) {
			// Saved by a newer Hoist: use it, but never write an older shape over it.
			this.readOnly = true;
			this.persistent = false;
		}
		return m.progress;
	}

	save(progress: Progress): boolean {
		if (this.readOnly || !this.persistent) return false;
		const raw = readRaw();
		const { settings: _, ...rest } = progress;
		return writeRaw({ ...raw, ...rest });
	}
}

/** Keeps progress for the session only (tests, and as a stand-in). */
export class MemoryStore implements ProgressStore {
	readonly persistent = false;
	private saved: Progress;
	constructor(initial: unknown = {}) {
		this.saved = migrate(initial).progress;
	}
	load(): Progress {
		return structuredClone(this.saved);
	}
	save(progress: Progress): boolean {
		this.saved = structuredClone(progress);
		return true;
	}
}
