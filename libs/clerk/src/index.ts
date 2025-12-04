import { createClerkClient } from '@clerk/backend';
import { z } from 'zod';

export { type User } from '@clerk/backend';

export const ClerkWebhookUser = z.object({
	id: z.string(),
	username: z.string(),
	first_name: z.string(),
	last_name: z.string(),
	image_url: z.string(),
});

let _clerkClient: ReturnType<typeof createClerkClient> | null = null;

// Lazy initialize the Clerk client for inngest workflows
export function getClerkClient() {
	if (!_clerkClient) {
		const secretKey = process.env.CLERK_SECRET_KEY;
		if (!secretKey) {
			throw new Error('CLERK_SECRET_KEY is not set');
		}
		_clerkClient = createClerkClient({ secretKey });
	}
	return _clerkClient;
}

export const clerk = getClerkClient();

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
