// No pino — its Node build doesn't run under `workerd`. Plain JSON lines via
// console.log/warn/error instead, scraped by Cloudflare Workers Logs.
//
// Reads LOG_LEVEL via $env/dynamic/private, not process.env (unavailable
// under adapter-cloudflare). Safe to cache at module scope, unlike db.ts/
// auth.ts's request-scoped clients — env vars are static per Worker
// lifetime, not per-request.
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
