import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';

import { db } from '../db';
import { users } from '../db/schema';
import { profileColumns } from './user-profile-fields';

type ClerkEmailAddress = {
	id?: string | null;
	emailAddress?: string | null;
};

type ClerkCommerceUser = {
	id: string;
	firstName?: string | null;
	lastName?: string | null;
	fullName?: string | null;
	imageUrl?: string | null;
	primaryEmailAddressId?: string | null;
	primaryEmailAddress?: ClerkEmailAddress | null;
	emailAddresses?: ClerkEmailAddress[];
};

// One fallback, not a retry loop: preserve legal utf8mb4 profiles, but never
// let cosmetic values prevent linking on an older utf8mb3 table.
async function writeWithProfileFallback(
	profile: ReturnType<typeof profileColumns>,
	write: (profile: ReturnType<typeof profileColumns>) => PromiseLike<unknown>,
) {
	try {
		await write(profile);
		return profile;
	} catch (error) {
		// mysql2 exposes errno; PlanetScale embeds it in the Vitess message.
		const cause = error instanceof Error && error.cause ? error.cause : error;
		const errno =
			Number((cause as { errno?: number })?.errno) ||
			Number(
				(cause instanceof Error ? cause.message : '').match(
					/\berrno\s*[:=]?\s*(1366|1406)\b/i,
				)?.[1],
			);
		if (errno !== 1366 && errno !== 1406) throw error;
		console.warn('Retrying Clerk user write without cosmetic profile fields', {
			fields: Object.entries(profile)
				.filter(([, value]) => value !== null)
				.map(([field, value]) => ({ field, length: [...value!].length })),
			errno,
		});
		const fallback = { name: null, image: null };
		await write(fallback);
		return fallback;
	}
}

function getDisplayName(user: ClerkCommerceUser) {
	return (
		user.fullName ??
		([user.firstName, user.lastName].filter(Boolean).join(' ') || null)
	);
}

function getPrimaryEmail(user: ClerkCommerceUser) {
	const primaryEmail = user.primaryEmailAddress?.emailAddress
		? user.primaryEmailAddress
		: user.emailAddresses?.find(
				(email) => email.id === user.primaryEmailAddressId,
			);

	return (
		primaryEmail?.emailAddress ??
		user.emailAddresses?.find((email) => email.emailAddress)?.emailAddress ??
		`${user.id}@clerk.codetv.dev`
	);
}

/** Admin authorization only reads existing users; it never provisions an account. */
export async function findCourseBuilderUserForClerkUser(
	clerkUser: ClerkCommerceUser | null,
) {
	if (!clerkUser?.id) return null;
	const byId = await db.query.users.findFirst({
		where: eq(users.externalId, clerkUser.id),
	});
	if (byId) return byId;
	return (
		(await db.query.users.findFirst({
			where: eq(users.email, getPrimaryEmail(clerkUser)),
		})) ?? null
	);
}

export async function getCourseBuilderUserForClerkUser(
	clerkUser: ClerkCommerceUser | null,
	database = db,
) {
	if (!clerkUser?.id) return null;

	const existingByExternalId = await database.query.users.findFirst({
		where: eq(users.externalId, clerkUser.id),
	});

	if (existingByExternalId) return existingByExternalId;

	const email = getPrimaryEmail(clerkUser);
	const existingByEmail = await database.query.users.findFirst({
		where: eq(users.email, email),
	});

	if (existingByEmail) {
		const fields = {
			...(existingByEmail.fields ?? {}),
			externalId: clerkUser.id,
		};
		const profile = profileColumns({
			name: existingByEmail.name ?? getDisplayName(clerkUser),
			image: existingByEmail.image ?? clerkUser.imageUrl,
		});

		const savedProfile = await writeWithProfileFallback(profile, (values) =>
			database
				.update(users)
				.set({ fields, ...values })
				.where(eq(users.id, existingByEmail.id)),
		);

		return {
			...existingByEmail,
			fields,
			...savedProfile,
			externalId: clerkUser.id,
		};
	}

	const id = `user_${randomUUID()}`;

	await writeWithProfileFallback(
		profileColumns({
			name: getDisplayName(clerkUser),
			image: clerkUser.imageUrl,
		}),
		(profile) =>
			database.insert(users).values({
				id,
				email,
				...profile,
				fields: { externalId: clerkUser.id },
			}),
	);

	return (
		(await database.query.users.findFirst({
			where: eq(users.id, id),
		})) ?? null
	);
}
