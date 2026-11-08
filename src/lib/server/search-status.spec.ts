import { describe, expect, it } from 'vitest';
import { engineFailures } from './search-status.ts';

describe('upstream engine diagnostics', () => {
	it('translates blocks, suspension, access denial and timeouts', () => {
		expect(
			engineFailures([
				['duckduckgo', 'CAPTCHA'],
				['google cse', 'Suspended: too many requests'],
				['google', 'access denied'],
				['wikidata', 'timeout'],
				['bing', 'HTTP 429'],
				['yahoo', 'HTTP 403'],
				['brave', 'unexpected response']
			])
		).toEqual([
			{ engine: 'duckduckgo', reason: 'CAPTCHA' },
			{ engine: 'google cse', reason: 'limite de requisições' },
			{ engine: 'google', reason: 'acesso negado' },
			{ engine: 'wikidata', reason: 'tempo esgotado' },
			{ engine: 'bing', reason: 'limite de requisições' },
			{ engine: 'yahoo', reason: 'acesso negado' },
			{ engine: 'brave', reason: 'indisponível' }
		]);
	});
	it('ignores malformed names, deduplicates failures and never exposes raw errors', () => {
		expect(engineFailures(null)).toEqual([]);
		expect(
			engineFailures([
				null,
				{},
				'bad',
				[null, 'timeout'],
				['https://private.internal', 'secret'],
				['brave', 'secret at http://private.internal'],
				['brave', 'timeout']
			])
		).toEqual([{ engine: 'brave', reason: 'tempo esgotado' }]);
	});
	it('bounds diagnostics even for an unexpectedly large upstream payload', () => {
		expect(
			engineFailures(Array.from({ length: 100 }, (_, i) => [`engine-${i}`, 'timeout']))
		).toHaveLength(20);
	});
});
