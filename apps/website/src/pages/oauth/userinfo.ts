import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';

import { db } from '../../db';
import { deviceAccessToken as deviceAccessTokenTable, users } from '../../db/schema';
import { withSkill } from '../../server/with-skill';

export const GET: APIRoute = async ({ request }) =>
	withSkill(async (request) => {
		const deviceAccessToken = request.headers
			.get('Authorization')
			?.split(' ')[1];

		if (!deviceAccessToken) {
			return Response.json(
				{
					error: 'access_denied',
					error_description: 'Nothing to see here.',
				},
				{ status: 403 },
			);
		}

		const token = await db.query.deviceAccessToken.findFirst({
			where: eq(deviceAccessTokenTable.token, deviceAccessToken),
		});

		if (!token?.userId) {
			return Response.json(
				{
					error: 'not_found',
					error_description: 'User not found.',
				},
				{ status: 404 },
			);
		}

		const user = await db.query.users.findFirst({
			where: eq(users.id, token.userId),
		});

		if (!user) {
			return Response.json(
				{
					error: 'not_found',
					error_description: 'User not found.',
				},
				{ status: 404 },
			);
		}

		return Response.json({ ...user });
	})(request);
