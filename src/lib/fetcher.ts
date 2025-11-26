/**
 * Small fetch helper with timeout and retries, returning parsed JSON.
 * Defaults: timeout 7000ms, retries 2 (total attempts = retries)
 */
/**
 * Shared fetch helper. Defaults are configurable via environment variables:
 * - FETCH_TIMEOUT_MS (default 7000)
 * - FETCH_MAX_ATTEMPTS (default 2)
 */
export async function fetcher(url: string, timeoutMs?: number, maxAttempts?: number) {
	const DEFAULT_TIMEOUT = Number(process.env.FETCH_TIMEOUT_MS) || 7000;
	const DEFAULT_MAX_ATTEMPTS = Number(process.env.FETCH_MAX_ATTEMPTS) || 2;

	const t = typeof timeoutMs === 'number' ? timeoutMs : DEFAULT_TIMEOUT;
	const attempts = typeof maxAttempts === 'number' ? maxAttempts : DEFAULT_MAX_ATTEMPTS;

	for (let attempt = 1; attempt <= attempts; attempt++) {
		const controller = new AbortController();
		const id = setTimeout(() => controller.abort(), t);
		try {
			const res = await fetch(url, { signal: controller.signal });
			if (!res.ok) {
				const text = await res.text().catch(() => '');
				throw new Error(`HTTP ${res.status}: ${text}`);
			}
			const json = await res.json().catch(() => null);
			return json;
		} catch (err) {
			if (attempt < attempts) {
				const delay = Math.pow(2, attempt) * 200;
				await new Promise(r => setTimeout(r, delay));
				continue;
			}
			throw err;
		} finally {
			clearTimeout(id);
		}
	}
	return null;
}
