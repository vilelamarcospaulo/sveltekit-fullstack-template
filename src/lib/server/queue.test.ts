import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockEnv: { QUEUE_LOCAL_PUSH_URL?: string } = {};
vi.mock('$env/dynamic/private', () => ({ env: mockEnv }));

const { sendJob } = await import('./queue');
const { HELLO_QUEUE } = await import('$lib/internal/domain/jobs');

describe('sendJob', () => {
	beforeEach(() => {
		delete mockEnv.QUEUE_LOCAL_PUSH_URL;
		vi.unstubAllGlobals();
	});

	it('sends through the platform queue binding when no local push URL is configured', async () => {
		const send = vi.fn(async () => {});
		const platform = { env: { HELLO_QUEUE: { send } } } as unknown as App.Platform;

		await sendJob(HELLO_QUEUE, { message: 'hi' }, 'trace-1', platform);

		expect(send).toHaveBeenCalledExactlyOnceWith({
			payload: { message: 'hi' },
			traceId: 'trace-1'
		});
	});

	it('prefers QUEUE_LOCAL_PUSH_URL over a resolved platform binding, so a same-process, no-consumer local binding never silently swallows the job', async () => {
		mockEnv.QUEUE_LOCAL_PUSH_URL = 'http://localhost:8797/push';
		const fetchMock = vi.fn(
			async () => new Response(JSON.stringify({ success: true }), { status: 200 })
		);
		vi.stubGlobal('fetch', fetchMock);
		const send = vi.fn(async () => {});
		const platform = { env: { HELLO_QUEUE: { send } } } as unknown as App.Platform;

		await sendJob(HELLO_QUEUE, { message: 'hi' }, 'trace-1', platform);

		expect(fetchMock).toHaveBeenCalledOnce();
		expect(send).not.toHaveBeenCalled();
	});

	it('falls back to QUEUE_LOCAL_PUSH_URL when no binding resolves for the queue name', async () => {
		mockEnv.QUEUE_LOCAL_PUSH_URL = 'http://localhost:8797/push';
		const fetchMock = vi.fn(
			async () => new Response(JSON.stringify({ success: true }), { status: 200 })
		);
		vi.stubGlobal('fetch', fetchMock);

		await sendJob(HELLO_QUEUE, { message: 'hi' }, 'trace-1', undefined);

		expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
			'http://localhost:8797/push',
			expect.objectContaining({
				method: 'POST',
				body: JSON.stringify({ body: { payload: { message: 'hi' }, traceId: 'trace-1' } })
			})
		);
	});

	it('throws when the local push responds without success:true', async () => {
		mockEnv.QUEUE_LOCAL_PUSH_URL = 'http://localhost:8797/push';
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response(JSON.stringify({ success: false }), { status: 200 }))
		);

		await expect(sendJob(HELLO_QUEUE, { message: 'hi' }, 'trace-1', undefined)).rejects.toThrow(
			/Failed to send job/
		);
	});

	it('throws a descriptive error when no transport is configured for the queue name', async () => {
		await expect(sendJob(HELLO_QUEUE, { message: 'hi' }, 'trace-1', undefined)).rejects.toThrow(
			/No queue transport configured for queue "hello"/
		);
	});

	it('does not resolve a binding for an unrecognized queue name, even with a platform present', async () => {
		const send = vi.fn(async () => {});
		const platform = { env: { HELLO_QUEUE: { send } } } as unknown as App.Platform;

		await expect(sendJob('unknown-queue', { message: 'hi' }, 'trace-1', platform)).rejects.toThrow(
			/No queue transport configured for queue "unknown-queue"/
		);
		expect(send).not.toHaveBeenCalled();
	});
});
