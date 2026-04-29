import type { APIRoute } from 'astro';

import { getUserAbilityForRequest } from '../../server/ability';
import { withSkill } from '../../server/with-skill';

export const GET: APIRoute = async ({ request }) =>
	withSkill(async (request) => {
		const { user } = await getUserAbilityForRequest(request);

		if (!user) {
			return Response.json(
				{
					error: 'access_denied',
					error_description: 'Nothing to see here.',
				},
				{ status: 403 },
			);
		}

		return Response.json({ ...user });
	})(request);
