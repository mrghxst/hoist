/**
 * Sound and touch after an answer (PROMPT.md 6.2). Sound is off by default:
 * one soft tick for right, one low tone for wrong, made with the Web Audio
 * API (no audio files). Haptics are on by default: a 10 ms vibration on a
 * right answer, on phones that support it.
 */
import type { Settings } from '#lib/learn/types.ts';

let audio: AudioContext | null = null;

function tone(freq: number, ms: number, gain: number, type: OscillatorType) {
	try {
		audio ??= new AudioContext();
		const t = audio.currentTime;
		const osc = audio.createOscillator();
		const amp = audio.createGain();
		osc.type = type;
		osc.frequency.setValueAtTime(freq, t);
		amp.gain.setValueAtTime(0, t);
		amp.gain.linearRampToValueAtTime(gain, t + 0.005);
		amp.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
		osc.connect(amp).connect(audio.destination);
		osc.start(t);
		osc.stop(t + ms / 1000 + 0.02);
	} catch {
		// No audio here: stay quiet.
	}
}

export function feedback(correct: boolean, settings: Settings) {
	if (settings.sound) {
		if (correct) tone(1320, 70, 0.05, 'triangle');
		else tone(196, 220, 0.07, 'sine');
	}
	if (correct && settings.haptics !== false) {
		try {
			navigator.vibrate?.(10);
		} catch {
			// Not supported.
		}
	}
}
