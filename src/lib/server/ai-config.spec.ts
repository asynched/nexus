import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAiConfig, aiAvailability } from './ai-config.ts';

const environment = vi.hoisted(() => ({}) as Record<string, string>);
vi.mock('$app/env/private', () => ({
	get AI_ENABLED() {
		return environment.AI_ENABLED;
	},
	get AI_AGENT_ENABLED() {
		return environment.AI_AGENT_ENABLED;
	},
	get AI_API_KEY() {
		return environment.AI_API_KEY;
	},
	get AI_BASE_URL() {
		return environment.AI_BASE_URL;
	},
	get AI_MODEL() {
		return environment.AI_MODEL;
	},
	get AI_MAX_STEPS() {
		return environment.AI_MAX_STEPS;
	},
	get AI_MAX_OUTPUT_TOKENS() {
		return environment.AI_MAX_OUTPUT_TOKENS;
	}
}));
beforeEach(() => {
	Object.keys(environment).forEach((key) => delete environment[key]);
	Object.assign(environment, {
		AI_ENABLED: 'true',
		AI_AGENT_ENABLED: 'true',
		AI_API_KEY: 'test-private-key',
		AI_BASE_URL: 'https://model.example/v1',
		AI_MODEL: 'deepseek-v4.1-flash',
		AI_MAX_STEPS: '4',
		AI_MAX_OUTPUT_TOKENS: '1800'
	});
});

describe('private runtime AI configuration', () => {
	it('exports only capabilities to the page, never credentials or provider configuration', () => {
		expect(aiAvailability()).toEqual({ summary: true, agent: true });
		environment.AI_AGENT_ENABLED = 'false';
		expect(aiAvailability()).toEqual({ summary: true, agent: false });
	});
	it.each(['AI_ENABLED', 'AI_API_KEY'])('requires both opt-in and a key (%s)', (key) => {
		delete environment[key];
		expect(aiAvailability()).toEqual({ summary: false, agent: false });
	});
	it.each([
		['AI_BASE_URL', 'https://user:secret@example.com/'],
		['AI_BASE_URL', 'file:///secret'],
		['AI_BASE_URL', 'https://example.com/?token=secret'],
		['AI_MAX_STEPS', '100'],
		['AI_BASE_URL', 'http://public-provider.example/v1'],
		['AI_MAX_OUTPUT_TOKENS', '100000'],
		['AI_MODEL', '']
	])('rejects invalid %s without exposing its value', (key, value) => {
		environment[key] = value;
		expect(() => getAiConfig()).toThrow('A IA não está disponível nesta instalação.');
		expect(aiAvailability().summary).toBe(false);
	});
});
