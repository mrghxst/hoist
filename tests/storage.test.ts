import { describe, expect, it, beforeEach } from 'vitest';
import { readSettings, writeSettings, STORAGE_KEY } from '../src/lib/store/storage.ts';

class MemoryStorage {
	map = new Map<string, string>();
	getItem(k: string) {
		return this.map.get(k) ?? null;
	}
	setItem(k: string, v: string) {
		this.map.set(k, v);
	}
	removeItem(k: string) {
		this.map.delete(k);
	}
}

describe('storage', () => {
	beforeEach(() => {
		(globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage();
	});

	it('round-trips settings under the versioned key', () => {
		writeSettings({ theme: 'dark' });
		expect(readSettings()).toEqual({ theme: 'dark' });
		expect(localStorage.getItem(STORAGE_KEY)).toContain('"theme":"dark"');
	});

	it('survives corrupt JSON', () => {
		localStorage.setItem(STORAGE_KEY, '{not json');
		expect(readSettings()).toEqual({});
	});

	it('survives storage that throws', () => {
		(globalThis as { localStorage?: unknown }).localStorage = {
			getItem() {
				throw new Error('blocked');
			},
			setItem() {
				throw new Error('blocked');
			}
		};
		expect(readSettings()).toEqual({});
		expect(writeSettings({ theme: 'light' })).toBe(false);
	});
});
