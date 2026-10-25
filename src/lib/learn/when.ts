/** "in 10 minutes", "in 3 hours", "tomorrow", "in 4 days": when something is due. */
export function until(at: number, now = Date.now()): string {
	const min = Math.max(1, Math.round((at - now) / 60_000));
	if (min < 60) return `in ${min} minute${min === 1 ? '' : 's'}`;
	const hours = Math.round(min / 60);
	const today = new Date(now);
	const then = new Date(at);
	const days = Math.round(
		(Date.UTC(then.getFullYear(), then.getMonth(), then.getDate()) - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) /
			86_400_000
	);
	if (days === 0) return `in ${hours} hour${hours === 1 ? '' : 's'}`;
	if (days === 1) return 'tomorrow';
	return `in ${days} days`;
}
