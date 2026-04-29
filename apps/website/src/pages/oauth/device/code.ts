import type { APIRoute } from 'astro';
import { hri } from 'human-readable-ids';
import { eq } from 'drizzle-orm';

import { db } from '../../../db';
import { deviceVerifications } from '../../../db/schema';
import { getBaseUrl } from '../../../server/url';
import { withSkill } from '../../../server/with-skill';

export const POST: APIRoute = async ({ request }) =>
	withSkill(async () => {
		const TEN_MINUTES_IN_MILLISECONDS = 60 * 10 * 1000;
		const expires = new Date(Date.now() + TEN_MINUTES_IN_MILLISECONDS + 10000);
		const userCode = hri.random();
		const deviceCode = crypto.randomUUID();

		await db.insert(deviceVerifications).values({
			userCode,
			deviceCode,
			createdAt: new Date(),
			expires,
		});

		const deviceVerification = await db.query.deviceVerifications.findFirst({
			where: eq(deviceVerifications.deviceCode, deviceCode),
		});

		if (!deviceVerification) {
			return Response.json(
				{ error: 'Device verification not found' },
				{ status: 404 },
			);
		}

		const baseUrl = getBaseUrl(request);

		return Response.json({
			device_code: deviceVerification.deviceCode,
			user_code: deviceVerification.userCode,
			verification_uri: `${baseUrl}/activate`,
			verification_uri_complete: `${baseUrl}/activate?user_code=${deviceVerification.userCode}`,
			expires_in: TEN_MINUTES_IN_MILLISECONDS / 1000,
			interval: 5,
		});
	})(request);
