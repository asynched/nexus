import { describe, expect, it } from 'vitest';
import { citationParts } from './ai.ts';

describe('AI citation rendering', () => {
	it('links only numeric references to sources collected by the server', () => {
		const source = { id: 1, title: 'Source', url: 'https://example.com', domain: 'example.com' };
		const parts = citationParts('Resposta [1] [99] <script>alert(1)</script>', [source]);
		expect(parts.filter((part) => part.source)).toEqual([{ text: '[1]', source }]);
		expect(parts.map((part) => part.text).join('')).toContain('<script>');
		expect(parts.find((part) => part.text === '[99]')?.source).toBeUndefined();
	});
});
