import type { APIRoute } from 'astro';

import { getBaseUrl } from '../../server/url';

export const GET: APIRoute = async ({ request }) => {
	const baseUrl = getBaseUrl(request);

	return Response.json({
		id: 'codetv',
		displayName: 'CodeTV',
		baseUrl,
		auth: {
			deviceCode: '/oauth/device/code',
			token: '/oauth/token',
			userinfo: '/oauth/userinfo',
			openidConfiguration: '/oauth/.well-known/openid-configuration',
		},
		capabilities: {
			content: {
				api: '/api',
				lessons: '/api/lessons',
			},
		},
		_links: {
			self: '/.well-known/coursebuilder-app',
			api: '/api',
		},
		next_actions: [
			{
				command: 'auth login --app codetv',
				description: 'Authorize the CourseBuilder CLI for CodeTV',
			},
		],
	});
};
