import { describe, expect, it } from 'vitest';
import { AiLimiter } from './ai-limit.ts';

describe('paid AI request limits', () => {
	it('limits each client to one concurrent request and six per minute', () => {
		const limiter = new AiLimiter();
		const release = limiter.acquire('client', 0)!;
		expect(limiter.acquire('client', 0)).toBeUndefined();
		release();
		release();
		for (let i = 0; i < 5; i++) {
			const next = limiter.acquire('client', 0);
			expect(next).toBeTypeOf('function');
			next!();
		}
		expect(limiter.acquire('client', 0)).toBeUndefined();
	});
	it('resets a completed window without leaking active slots', () => {
		const limiter = new AiLimiter();
		for (let i = 0; i < 6; i++) limiter.acquire('client', 0)!();
		expect(limiter.acquire('client', 59000)).toBeUndefined();
		expect(limiter.acquire('client', 60000)).toBeTypeOf('function');
	});
	it('caps global concurrency independently of client identity', () => {
		const limiter = new AiLimiter();
		const releases = Array.from({ length: 4 }, (_, i) => limiter.acquire(`client-${i}`, 0)!);
		expect(limiter.acquire('fifth', 0)).toBeUndefined();
		releases[0]();
		expect(limiter.acquire('fifth', 0)).toBeTypeOf('function');
	});
	it('bounds total request spend even when clients change identity', () => {
		const limiter = new AiLimiter();
		for (let i = 0; i < 60; i++) limiter.acquire(`client-${i}`, 0)!();
		expect(limiter.acquire('another-client', 1)).toBeUndefined();
		expect(limiter.acquire('another-client', 60000)).toBeTypeOf('function');
	});
});
