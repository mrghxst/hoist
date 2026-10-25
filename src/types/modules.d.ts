// Minimal types for untyped dependencies.

declare module 'versor' {
	type Rotation = [number, number] | [number, number, number];
	type Quaternion = [number, number, number, number];
	type Cartesian = [number, number, number];
	interface Versor {
		(rotation: Rotation): Quaternion;
		cartesian(point: [number, number]): Cartesian;
		rotation(q: Quaternion): [number, number, number];
		delta(from: Cartesian, to: Cartesian, alpha?: number): Quaternion;
		multiply(a: Quaternion, b: Quaternion): Quaternion;
		interpolate(a: Rotation, b: Rotation): (t: number) => [number, number, number];
	}
	const versor: Versor;
	export default versor;
}

declare module 'mapshaper' {
	const mapshaper: {
		applyCommands(commands: string, input?: Record<string, unknown>): Promise<Record<string, string | Uint8Array>>;
		runCommands(commands: string): Promise<void>;
	};
	export default mapshaper;
}
