import { describe, expect, it } from 'vitest';
import { GET } from './+server';

describe('container liveness', () => {
	it('returns an uncached response without contacting the search service', async () => {
		const response = GET();
		expect(response.status).toBe(200);
		expect(response.headers.get('Cache-Control')).toBe('no-store');
		expect(await response.json()).toEqual({ status: 'ok' });
	});
});
