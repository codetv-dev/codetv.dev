import { eq } from 'drizzle-orm';

import { db } from '../db';
import { deviceAccessToken, users } from '../db/schema';

import { getAbility } from './ability-rules';
export { getAbility } from './ability-rules';

export async function getUserAbilityForRequest(request: Request) {
	const authToken = request.headers
		.get('Authorization')
		?.match(/^Bearer\s+(\S+)$/i)?.[1];

	if (!authToken) {
		return { user: null, ability: getAbility() };
	}

	const token = await db.query.deviceAccessToken.findFirst({
		where: eq(deviceAccessToken.token, authToken),
	});

	if (!token?.userId) {
		return { user: null, ability: getAbility() };
	}

	// Device tokens don't expire. Revoke one by deleting its DeviceAccessToken row.

	const user =
		(await db.query.users.findFirst({ where: eq(users.id, token.userId) })) ??
		null;

	return { user, ability: getAbility({ user }) };
}
