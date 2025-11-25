/**
 * Small fetch helper with timeout and retries, returning parsed JSON.
 * Defaults: timeout 7000ms, retries 2 (total attempts = retries)
 */
export async function fetcher(url: string, timeoutMs = 7000, maxAttempts = 2) {
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		const controller = new AbortController();
		const id = setTimeout(() => controller.abort(), timeoutMs);
		try {
			const res = await fetch(url, { signal: controller.signal });
			if (!res.ok) {
				const text = await res.text().catch(() => '');
				throw new Error(`HTTP ${res.status}: ${text}`);
			}
			const json = await res.json().catch(() => null);
			return json;
		} catch (err) {
			if (attempt < maxAttempts) {
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
