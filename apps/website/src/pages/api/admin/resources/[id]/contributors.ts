import type { APIRoute } from 'astro';
import { ContentError } from '../../../../../server/content-contract';
import {
	contentRoute,
	readContentJson,
} from '../../../../../server/content-http';
export const prerender = false;
const body = async (context: Parameters<APIRoute>[0]) => {
	const input = await readContentJson(context.request);
	if (!input || typeof input !== 'object' || Array.isArray(input))
		throw new ContentError(
			400,
			'Send userId or email in a JSON object.',
			'The user must already exist.',
		);
	return { ...input, id: context.params.id };
};
export const GET: APIRoute = async (context) =>
	contentRoute(context, 'list_contributors', () => ({ id: context.params.id }));
export const POST: APIRoute = async (context) =>
	contentRoute(context, 'add_contributor', () => body(context));
export const DELETE: APIRoute = async (context) =>
	contentRoute(context, 'remove_contributor', () => body(context));
