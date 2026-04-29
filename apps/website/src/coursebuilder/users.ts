import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';

import { db } from '../db';
import { users } from '../db/schema';

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

export async function getCourseBuilderUserForClerkUser(
	clerkUser: ClerkCommerceUser | null,
) {
	if (!clerkUser?.id) return null;

	const existingByExternalId = await db.query.users.findFirst({
		where: eq(users.externalId, clerkUser.id),
	});

	if (existingByExternalId) return existingByExternalId;

	const email = getPrimaryEmail(clerkUser);
	const existingByEmail = await db.query.users.findFirst({
		where: eq(users.email, email),
	});

	if (existingByEmail) {
		const fields = {
			...(existingByEmail.fields ?? {}),
			externalId: clerkUser.id,
		};

		await db
			.update(users)
			.set({
				fields,
				name: existingByEmail.name ?? getDisplayName(clerkUser),
				image: existingByEmail.image ?? clerkUser.imageUrl ?? null,
			})
			.where(eq(users.id, existingByEmail.id));

		return {
			...existingByEmail,
			fields,
			name: existingByEmail.name ?? getDisplayName(clerkUser),
			image: existingByEmail.image ?? clerkUser.imageUrl ?? null,
		};
	}

	const id = `user_${randomUUID()}`;

	await db.insert(users).values({
		id,
		email,
		name: getDisplayName(clerkUser),
		image: clerkUser.imageUrl ?? null,
		fields: {
			externalId: clerkUser.id,
		},
	});

	return (
		(await db.query.users.findFirst({
			where: eq(users.id, id),
		})) ?? null
	);
}
