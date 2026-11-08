export type EngineFailure = { engine: string; reason: string };

/** Never send raw upstream exception messages (which can contain internal URLs) to the client. */
export function engineFailures(input: unknown): EngineFailure[] {
	if (!Array.isArray(input)) return [];
	const failures = new Map<string, EngineFailure>();
	for (const entry of input) {
		if (!Array.isArray(entry)) continue;
		const [engine, detail] = entry;
		if (typeof engine !== 'string' || !/^[a-z0-9][a-z0-9 ._-]{0,63}$/i.test(engine)) continue;
		const message = typeof detail === 'string' ? detail.toLowerCase() : '';
		const reason = message.includes('captcha')
			? 'CAPTCHA'
			: message.includes('too many requests') || message.includes('429')
				? 'limite de requisições'
				: message.includes('timeout')
					? 'tempo esgotado'
					: message.includes('access denied') || message.includes('403')
						? 'acesso negado'
						: 'indisponível';
		failures.set(engine, { engine, reason });
		if (failures.size === 20) break;
	}
	return [...failures.values()];
}
