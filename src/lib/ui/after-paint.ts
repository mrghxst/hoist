/**
 * Resolves once the browser has shown the first contentful paint, so heavy
 * work (the globe, quiz data) does not compete with the first frame. Falls
 * back to a timer where paint timing is not supported.
 */
let ready: Promise<void> | undefined;

export function afterFirstPaint(timeout = 1500): Promise<void> {
	ready ??= new Promise<void>((resolve) => {
		const done = () => setTimeout(resolve, 0);
		const timer = setTimeout(done, timeout);
		try {
			const finish = () => {
				clearTimeout(timer);
				observer.disconnect();
				done();
			};
			const observer = new PerformanceObserver((list) => {
				if (list.getEntries().some((e) => e.name === 'first-contentful-paint')) finish();
			});
			observer.observe({ type: 'paint', buffered: true });
		} catch {
			// No paint timing: the timer above still resolves.
		}
	});
	return ready;
}
