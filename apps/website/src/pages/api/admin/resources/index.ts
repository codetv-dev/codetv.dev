import type { APIRoute } from 'astro';
import { contentRoute, readContentJson } from '../../../../server/content-http';
export const prerender = false;
export const GET: APIRoute = async (context) =>
	contentRoute(context, 'list_resources', () => {
		const input: Record<string, unknown> = Object.fromEntries(
			context.url.searchParams,
		);
		for (const key of ['limit', 'offset'])
			if (key in input) input[key] = Number(input[key]);
		return input;
	});
export const POST: APIRoute = async (context) =>
	contentRoute(
		context,
		'create_resource',
		() => readContentJson(context.request),
		201,
	);
