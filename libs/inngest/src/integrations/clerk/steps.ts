import { clerk, type User } from '@codetv/clerk';
import { inngest } from '../../client.js';
import { imageUpload } from '../cloudinary/steps.ts';
import { personGetByClerkId, personUpsert } from '../sanity/steps.ts';
import { NonRetriableError } from 'inngest';

export const handleWebhookUserCreatedOrUpdated = inngest.createFunction(
	{ id: 'clerk/user-created-or-updated' },
	[{ event: 'clerk/user.created' }, { event: 'clerk/user.updated' }],
	async ({ event, step }) => {
		const user_id = event.data.id;
		const username = event.data.username;
		const firstName = event.data.first_name;
		const lastName = event.data.last_name;
		const name = firstName + ' ' + lastName;

		const userPromise = step.invoke('check-for-existing-user', {
			function: personGetByClerkId,
			data: {
				clerkUserId: user_id,
			},
		});

		const avatarPromise = step.invoke('upload-user-avatar', {
			function: imageUpload,
			data: {
				imageUrl: event.data.image_url,
				username: event.data.username,
			},
		});

		const [user, avatar] = await Promise.all([userPromise, avatarPromise]);

		await step.invoke('upsert-sanity-person', {
			function: personUpsert,
			data: {
				user,
				user_id,
				name,
				username,
				avatar,
			},
		});
	},
);

export const userSubscriptionUpdate = inngest.createFunction(
	{ id: 'clerk/user.subscription.update' },
	{ event: 'clerk/user.subscription.update' },
	async ({ event, step }) => {
		return step.run('clerk/update-subscription-details', async () => {
			return clerk.users.updateUserMetadata(event.data.clerkUserId, {
				publicMetadata: {
					stripe: {
						customer: event.data.stripeCustomerId,
						status: event.data.subscriptionStatus,
						level: event.data.productName,
					},
				},
			});
		}) as Promise<User>;
	},
);

export const userGetExternalAccountId = inngest.createFunction(
	{ id: 'clerk/user.external-account.get-id' },
	{ event: 'clerk/user.external-account.get-id' },
	async ({ event, step }) => {
		return step.run('clerk/user.external-account.get-id', async () => {
			const { user, provider } = event.data;

			const account = user.externalAccounts.find(
				(acct) => acct.provider === provider,
			);

			if (!account) {
				return false;
			}

			return account.externalId;
		});
	},
);

export const userGetById = inngest.createFunction(
	{ id: 'clerk/user.get-by-id' },
	{ event: 'clerk/user.get-by-id' },
	async ({ event, step }) => {
		return step.run('clerk/user.get', async () => {
			return clerk.users.getUser(event.data.userId).catch((err) => {
				throw new NonRetriableError(err);
			});
		}) as Promise<User>;
	},
);
