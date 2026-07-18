// Canonical application logger.
//
// pino is NOT used here: its Node build doesn't run under Cloudflare's
// `workerd` runtime (no Node stream internals, no worker-thread-based
// transports). This is the same tiny, dependency-free pattern the Next.js
// sibling template uses: one JSON line per call via
// console.log/console.warn/console.error, captured by Cloudflare Workers Logs
// (and `wrangler tail`) the same way stdout would be scraped elsewhere.
//
// Reads LOG_LEVEL via $env/dynamic/private (not process.env) — under
// adapter-cloudflare, Worker vars/bindings live on `platform.env` /
// $env/dynamic/private, not process.env (unlike OpenNext's Next.js runtime,
// which explicitly copies vars into process.env). Safe to cache at module
// scope despite the general "don't cache request-scoped things" rule
// elsewhere in this codebase (db.ts, auth.ts): env vars are static for the
// lifetime of a deployed Worker, not per-request — LOG_LEVEL never changes
// mid-flight the way a pg connection's validity does.
//
// Usage:
//   import { logger } from "$lib/server/logger";
//   logger.info({ userId }, "profile_updated");
import { env } from '$env/dynamic/private';

const LEVELS = ['debug', 'info', 'warn', 'error'] as const;
type Level = (typeof LEVELS)[number];

function resolveLevel(): Level {
	const configured = env.LOG_LEVEL;
	return (LEVELS as readonly string[]).includes(configured ?? '') ? (configured as Level) : 'info';
}

const activeLevel = resolveLevel();

function isEnabled(level: Level): boolean {
	return LEVELS.indexOf(level) >= LEVELS.indexOf(activeLevel);
}

function errorReplacer(_key: string, value: unknown): unknown {
	if (value instanceof Error) {
		return { name: value.name, message: value.message, stack: value.stack };
	}
	return value;
}

function write(level: Level, fields: Record<string, unknown>, msg: string): void {
	if (!isEnabled(level)) return;

	const record = {
		level,
		time: new Date().toISOString(),
		...fields,
		msg
	};

	const line = JSON.stringify(record, errorReplacer);
	if (level === 'error') {
		console.error(line);
	} else if (level === 'warn') {
		console.warn(line);
	} else {
		console.log(line);
	}
}

export const logger = {
	debug: (fields: Record<string, unknown>, msg: string) => write('debug', fields, msg),
	info: (fields: Record<string, unknown>, msg: string) => write('info', fields, msg),
	warn: (fields: Record<string, unknown>, msg: string) => write('warn', fields, msg),
	error: (fields: Record<string, unknown>, msg: string) => write('error', fields, msg)
};
