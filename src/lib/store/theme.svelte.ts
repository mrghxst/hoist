import { readSettings, writeSettings } from './storage.ts';

export type ThemePref = 'system' | 'light' | 'dark';

const ORDER: ThemePref[] = ['system', 'light', 'dark'];

class ThemeState {
	pref = $state<ThemePref>('system');

	init() {
		const saved = readSettings().theme;
		if (saved === 'light' || saved === 'dark') this.pref = saved;
		this.apply();
	}

	cycle() {
		this.pref = ORDER[(ORDER.indexOf(this.pref) + 1) % ORDER.length] ?? 'system';
		writeSettings({ theme: this.pref });
		this.apply();
	}

	/** The theme actually shown, resolving "system". */
	get resolved(): 'light' | 'dark' {
		if (this.pref !== 'system') return this.pref;
		if (typeof matchMedia === 'undefined') return 'light';
		return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
	}

	private apply() {
		if (typeof document === 'undefined') return;
		const root = document.documentElement;
		if (this.pref === 'system') delete root.dataset.theme;
		else root.dataset.theme = this.pref;
	}
}

export const theme = new ThemeState();
