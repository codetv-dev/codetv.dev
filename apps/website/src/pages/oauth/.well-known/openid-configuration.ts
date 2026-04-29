import type { APIRoute } from 'astro';

import { getBaseUrl } from '../../../server/url';

export const GET: APIRoute = async ({ request }) => {
	const baseUrl = getBaseUrl(request);

	return Response.json({
		token_endpoint: `${baseUrl}/oauth/token`,
		token_endpoint_auth_methods_supported: [],
		response_types_supported: ['token'],
		scopes_supported: ['content:read', 'progress'],
		issuer: `${baseUrl}/oauth`,
		registration_endpoint: `${baseUrl}/oauth/register`,
		device_authorization_endpoint: `${baseUrl}/oauth/device/code`,
		claims_supported: ['email'],
		userinfo_endpoint: `${baseUrl}/oauth/userinfo`,
	});
};
