export type SkillRequest = Request;

type Handler<Args extends [SkillRequest, ...unknown[]]> = (
	...args: Args
) => Promise<Response> | Response;

function redactUrl(rawUrl: string) {
	const url = new URL(rawUrl);
	for (const key of url.searchParams.keys()) {
		if (/(token|secret|password|signature|code|key|auth|jwt|credential|session)/i.test(key)) {
			url.searchParams.set(key, '[REDACTED]');
		}
	}
	return `${url.pathname}${url.search}`;
}

export function withSkill<Args extends [SkillRequest, ...unknown[]]>(
	handler: Handler<Args>,
): Handler<Args> {
	return async (...args: Args) => {
		const request = args[0];
		const startedAt = Date.now();
		const path = redactUrl(request.url);

		console.info('api.request.started', {
			method: request.method,
			path,
			userAgent: request.headers.get('user-agent'),
		});

		try {
			const response = await handler(...args);
			console.info('api.request.completed', {
				method: request.method,
				path,
				status: response.status,
				durationMs: Date.now() - startedAt,
			});
			return response;
		} catch (error) {
			console.error('api.request.failed', {
				method: request.method,
				path,
				durationMs: Date.now() - startedAt,
				error,
			});
			throw error;
		}
	};
}
