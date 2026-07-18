import { describe, it, expect, vi } from 'vitest';

const sendJobMock = vi.fn(async () => {});
vi.mock('$lib/server/queue', () => ({ sendJob: sendJobMock }));

const { enqueueHelloJob } = await import('./enqueue_hello_job');
const { HELLO_QUEUE } = await import('$lib/internal/domain/jobs');

describe('enqueueHelloJob', () => {
	it('returns validation errors and never calls sendJob on invalid input', async () => {
		const result = await enqueueHelloJob({ message: '' }, {});

		expect(result).toEqual({ ok: false, errors: { message: expect.any(String) } });
		expect(sendJobMock).not.toHaveBeenCalled();
	});

	it('forwards the parsed payload, queue name, and platform to sendJob', async () => {
		sendJobMock.mockClear();
		const platform = { env: {} } as App.Platform;

		const result = await enqueueHelloJob({ message: 'hi' }, { traceId: 'trace-1', platform });

		expect(result).toEqual({ ok: true, traceId: 'trace-1' });
		expect(sendJobMock).toHaveBeenCalledExactlyOnceWith(
			HELLO_QUEUE,
			{ message: 'hi' },
			'trace-1',
			platform
		);
	});

	it('generates a traceId when none is supplied', async () => {
		sendJobMock.mockClear();

		const result = await enqueueHelloJob({ message: 'hi' }, {});

		expect(result.ok).toBe(true);
		expect(result.ok && result.traceId).toEqual(expect.any(String));
		expect(sendJobMock).toHaveBeenCalledExactlyOnceWith(
			HELLO_QUEUE,
			{ message: 'hi' },
			result.ok ? result.traceId : undefined,
			undefined
		);
	});
});
