// Unauthenticated GET endpoint that exists to demo calling this app's own
// JSON API from the client (see api-hello-demo.svelte).
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	return Response.json({
		message: 'Hello from the Starter Kit API.',
		timestamp: new Date().toISOString()
	});
};
