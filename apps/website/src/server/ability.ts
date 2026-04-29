import { eq } from 'drizzle-orm';

import { db } from '../db';
import { deviceAccessToken, users } from '../db/schema';

const TOKEN_TTL_HOURS = 24;

type AbilityUser = typeof users.$inferSelect;

export function getAbility(options: { user?: AbilityUser | null } = {}) {
	const role = options.user?.role ?? 'user';
	return {
		can(action: string, _subject?: string) {
			if (role === 'admin') return true;
			if (action === 'read') return Boolean(options.user);
			return false;
		},
		cannot(action: string, subject?: string) {
			return !this.can(action, subject);
		},
	};
}

export async function getUserAbilityForRequest(request: Request) {
	const authToken = request.headers.get('Authorization')?.split(' ')[1];

	if (!authToken) {
		return { user: null, ability: getAbility() };
	}

	const token = await db.query.deviceAccessToken.findFirst({
		where: eq(deviceAccessToken.token, authToken),
	});

	if (!token?.userId) {
		return { user: null, ability: getAbility() };
	}

	if (token.createdAt) {
		const ageMs = Date.now() - token.createdAt.getTime();
		const ttlMs = TOKEN_TTL_HOURS * 60 * 60 * 1000;
		if (ageMs > ttlMs) {
			console.warn('auth.token-expired', {
				token: `${authToken.slice(0, 8)}…`,
				ageHours: Math.round(ageMs / 3_600_000),
				ttlHours: TOKEN_TTL_HOURS,
			});
			return { user: null, ability: getAbility() };
		}
	}

	const user =
		(await db.query.users.findFirst({ where: eq(users.id, token.userId) })) ??
		null;

	return { user, ability: getAbility({ user }) };
}
