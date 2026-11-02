import type { APIRoute } from 'astro';
import { contentRoute, readContentJson } from '../../../../server/content-http';
export const prerender = false;
export const POST: APIRoute = async (context) =>
	contentRoute(
		context,
		'add_to_workshop',
		() => readContentJson(context.request),
		201,
	);
export const PATCH: APIRoute = async (context) =>
	contentRoute(context, 'update_relation', () =>
		readContentJson(context.request),
	);
export const DELETE: APIRoute = async (context) =>
	contentRoute(context, 'remove_from_workshop', () =>
		readContentJson(context.request),
	);
