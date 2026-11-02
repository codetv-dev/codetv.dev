import type { APIRoute } from 'astro';
import { ContentError } from '../../../../server/content-contract';
import { contentRoute, readContentJson } from '../../../../server/content-http';
export const prerender = false;
const body = async (context: Parameters<APIRoute>[0]) => {
	const input = await readContentJson(context.request);
	if (!input || typeof input !== 'object' || Array.isArray(input))
		throw new ContentError(
			400,
			'Send a JSON object.',
			'Use fields for updates or confirmed:true for deletion.',
		);
	return { ...input, id: context.params.id };
};
export const GET: APIRoute = async (context) =>
	contentRoute(context, 'get_resource', () => ({ id: context.params.id }));
export const PUT: APIRoute = async (context) =>
	contentRoute(context, 'update_resource', () => body(context));
export const PATCH = PUT;
export const DELETE: APIRoute = async (context) =>
	contentRoute(context, 'delete_resource', () => body(context));
