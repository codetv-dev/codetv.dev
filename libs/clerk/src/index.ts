import { createClerkClient, type ClerkClient } from '@clerk/backend';
import { z } from 'zod';

export { type User } from '@clerk/backend';

export const ClerkWebhookUser = z.object({
	id: z.string(),
	username: z.string(),
	first_name: z.string(),
	last_name: z.string(),
	image_url: z.string(),
});

// Lazy initialization to ensure env vars are loaded at runtime
let _clerk: ClerkClient | null = null;

function getClerk(): ClerkClient {
	if (!_clerk) {
		const secretKey = process.env.CLERK_SECRET_KEY;
		if (!secretKey) {
			throw new Error(
				'CLERK_SECRET_KEY is not set. Make sure to add it to your .env file.',
			);
		}
		_clerk = createClerkClient({ secretKey });
	}
	return _clerk;
}

// Proxy that lazily initializes the clerk client on first access
export const clerk = new Proxy({} as ClerkClient, {
	get(_target, prop) {
		return getClerk()[prop as keyof ClerkClient];
	},
});

export async function loadUsersByIDs(ids: Array<string>) {
	const result = await clerk.users.getUserList({
		userId: ids,
	});

	return result.data;
}

export async function getUserByUsername(username: string) {
	const result = await clerk.users.getUserList({
		username: [username],
		limit: 1,
	});

	return result.data.at(0);
}

export async function createUser(user: CreateUserParams) {
	try {
		const result = await clerk.users.createUser(user);

		return result;
	} catch (error: any) {
		if (error.errors.at(0).code === 'form_identifier_exists') {
			const result = await clerk.users.getUserList({
				username: [user.username!],
				limit: 1,
			});

			return result.data.at(0);
		}

		throw new Error(error);
	}
}
