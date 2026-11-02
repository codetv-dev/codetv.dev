import type { APIRoute } from 'astro';
import { ContentError } from '../../../../../server/content-contract';
import {
	contentRoute,
	readContentJson,
} from '../../../../../server/content-http';
export const prerender = false;
export const PUT: APIRoute = async (context) =>
	contentRoute(context, 'reorder', async () => {
		const input = await readContentJson(context.request);
		if (!input || typeof input !== 'object' || Array.isArray(input))
			throw new ContentError(
				400,
				'Send a JSON object with childIds.',
				'Include every current child exactly once.',
			);
		return { ...input, id: context.params.id };
	});
