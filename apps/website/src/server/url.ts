export function getBaseUrl(request?: Request) {
	const configured =
		process.env.COURSEBUILDER_URL ??
		process.env.PUBLIC_SITE_URL ??
		process.env.URL ??
		(process.env.NETLIFY && process.env.DEPLOY_PRIME_URL) ??
		(process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);

	if (configured) return configured.replace(/\/$/, '');

	if (request) {
		const url = new URL(request.url);
		return `${url.protocol}//${url.host}`;
	}

	return 'http://localhost:4321';
}
