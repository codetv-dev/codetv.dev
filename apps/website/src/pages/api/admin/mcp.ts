import type { APIRoute } from 'astro';
import { contentJson, contentFailure } from '../../../server/content-http';
import { handleContentMcp } from '../../../server/content-mcp';
import { contentOperationsForUser } from '../../../server/content-runtime';
export const prerender = false;
export const ALL: APIRoute = async ({ request, locals }) => {
	if (!locals.contentViewer)
		return contentJson(
			{
				error: 'Not found',
				why: 'Content access is required.',
				next: 'Use an authorized Course Builder device bearer token.',
			},
			404,
		);
	try {
		return await handleContentMcp(
			request,
			locals.contentViewer,
			contentOperationsForUser(locals.contentViewer),
		);
	} catch (error) {
		return contentFailure(error);
	}
};
