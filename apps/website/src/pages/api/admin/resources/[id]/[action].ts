import type { APIRoute } from 'astro';
import { ContentError } from '../../../../../server/content-contract';
import {
	contentRoute,
	contentJson,
	readContentJson,
} from '../../../../../server/content-http';
export const prerender = false;
export const POST: APIRoute = async (context) => {
	const action = context.params.action;
	if (action === 'publish' || action === 'unpublish' || action === 'archive')
		return contentRoute(context, action, () => ({ id: context.params.id }));
	if (action === 'mux')
		return contentRoute(context, 'attach_mux_asset', async () => {
			const input = await readContentJson(context.request);
			if (!input || typeof input !== 'object' || Array.isArray(input))
				throw new ContentError(
					400,
					'Send a JSON object with muxAssetId and playbackId.',
					'Use an imported asset and signed playback id.',
				);
			return { ...input, id: context.params.id };
		});
	return contentJson(
		{
			error: 'Not found',
			why: 'Unknown content action.',
			next: 'Use publish, unpublish, archive or mux.',
		},
		404,
	);
};
