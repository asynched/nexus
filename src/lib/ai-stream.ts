import { DefaultChatTransport, readUIMessageStream } from 'ai';
import {
	AI_STREAM_ERROR,
	AI_INTERRUPTED_ERROR,
	AI_TIMEOUT_ERROR,
	type AiAnswer,
	type AiMode,
	type AiUIMessage
} from './ai.ts';

/** Use the SDK's SSE transport/parser, not a hand-written token or UTF-8 parser. */
export async function readSearchAnswer(options: {
	mode: AiMode;
	search: string;
	signal: AbortSignal;
	onUpdate: (answer: AiAnswer) => void;
}) {
	let failure = '';
	const transport = new DefaultChatTransport<AiUIMessage>({
		api: '/api/ai',
		prepareSendMessagesRequest: () => ({ body: { mode: options.mode, search: options.search } }),
		fetch: Object.assign(
			async (url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
				const response = await fetch(url, init);
				if (!response.ok) {
					const body = await response.json().catch(() => null);
					failure = typeof body?.error === 'string' ? body.error : AI_STREAM_ERROR;
					throw new Error(failure);
				}
				return response;
			},
			{ preconnect: fetch.preconnect }
		)
	});
	try {
		const stream = await transport.sendMessages({
			trigger: 'submit-message',
			chatId: 'nexus-search',
			messageId: undefined,
			messages: [],
			abortSignal: options.signal
		});
		let complete = false;
		for await (const message of readUIMessageStream<AiUIMessage>({
			stream,
			terminateOnError: true,
			onError: (error) => {
				if (error instanceof Error && [AI_STREAM_ERROR, AI_TIMEOUT_ERROR].includes(error.message))
					failure = error.message;
			}
		})) {
			options.signal.throwIfAborted();
			const evidence = message.parts.find((part) => part.type === 'data-evidence');
			const text = message.parts.findLast((part) => part.type === 'text');
			if (evidence?.type === 'data-evidence') {
				complete = evidence.data.complete;
				options.onUpdate({
					text: text?.type === 'text' ? text.text : '',
					sources: evidence.data.sources,
					searches: evidence.data.searches,
					partial: evidence.data.partial
				});
			}
		}
		if (!complete) throw new Error(AI_INTERRUPTED_ERROR);
	} catch (error) {
		if (options.signal.aborted) throw options.signal.reason;
		throw new Error(
			failure ||
				(error instanceof Error && error.message === AI_INTERRUPTED_ERROR
					? AI_INTERRUPTED_ERROR
					: AI_STREAM_ERROR)
		);
	}
}
