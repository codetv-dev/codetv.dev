import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';

import { db } from '../../db';
import { deviceAccessToken, deviceVerifications, users } from '../../db/schema';
import { withSkill } from '../../server/with-skill';

export const POST: APIRoute = async ({ request }) =>
	withSkill(async (request) => {
		const formData = await request.formData();
		const deviceCode = formData.get('device_code');

		if (typeof deviceCode !== 'string') {
			return Response.json(
				{
					error: 'access_denied',
					error_description: 'The device code is invalid',
				},
				{ status: 403 },
			);
		}

		const deviceVerification = await db.query.deviceVerifications.findFirst({
			where: eq(deviceVerifications.deviceCode, deviceCode),
		});

		if (!deviceVerification) {
			return Response.json(
				{
					error: 'access_denied',
					error_description: 'The device code is invalid',
				},
				{ status: 403 },
			);
		}

		if (!deviceVerification.verifiedAt && new Date() > deviceVerification.expires) {
			return Response.json(
				{
					error: 'expired_token',
					error_description: 'The device verification has expired',
				},
				{ status: 403 },
			);
		}

		if (!deviceVerification.verifiedAt) {
			return Response.json(
				{
					error: 'authorization_pending',
					error_description: 'The device verification is pending',
				},
				{ status: 403 },
			);
		}

		if (!deviceVerification.verifiedByUserId) {
			return Response.json(
				{
					error: 'access_denied',
					error_description: 'User not found',
				},
				{ status: 403 },
			);
		}

		const user = await db.query.users.findFirst({
			where: eq(users.id, deviceVerification.verifiedByUserId),
		});

		if (!user) {
			return Response.json(
				{
					error: 'access_denied',
					error_description: 'User not found',
				},
				{ status: 403 },
			);
		}

		const token = crypto.randomUUID();

		await db.insert(deviceAccessToken).values({
			userId: user.id,
			token,
		});

		await db
			.delete(deviceVerifications)
			.where(eq(deviceVerifications.deviceCode, deviceVerification.deviceCode));

		return Response.json({
			access_token: token,
			token_type: 'bearer',
			scope: 'content:read progress',
		});
	})(request);
