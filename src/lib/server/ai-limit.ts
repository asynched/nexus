/** Process-local guardrails. Use a shared gateway limit when running multiple replicas. */
export class AiLimiter {
	private clients = new Map<string, { start: number; count: number; active: number }>();
	private active = 0;
	private window = { start: 0, count: 0 };
	acquire(client: string, now = Date.now()): (() => void) | undefined {
		if (now - this.window.start >= 60000) this.window = { start: now, count: 0 };
		for (const [key, state] of this.clients) {
			if (state.active === 0 && now - state.start >= 60000) this.clients.delete(key);
		}
		const state = this.clients.get(client) ?? { start: now, count: 0, active: 0 };
		if (
			state.active ||
			state.count >= 6 ||
			this.active >= 4 ||
			this.window.count >= 60 ||
			(!this.clients.has(client) && this.clients.size >= 5000)
		)
			return;
		this.window.count++;
		state.count++;
		state.active++;
		this.active++;
		this.clients.set(client, state);
		let released = false;
		return () => {
			if (released) return;
			released = true;
			state.active--;
			this.active--;
		};
	}
}

export const aiLimiter = new AiLimiter();
