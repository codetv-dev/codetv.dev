import type { PersonByClerkIdQueryResult } from '@codetv/types';
import {
	createPerson,
	getPersonByClerkId,
	updatePerson,
	updatePersonFromClerk,
	updatePersonSubscription,
} from '@codetv/sanity';
import { inngest } from '../../client.js';

export const personGetByClerkId = inngest.createFunction(
	{
		id: 'sanity/person.get-by-clerk-id',
		description:
			'Loads a person from Sanity using their Clerk user ID, if one exists.',
	},
	{ event: 'sanity/person.get-by-clerk-id' },
	async function ({ event }): Promise<PersonByClerkIdQueryResult | null> {
		return getPersonByClerkId({ user_id: event.data.clerkUserId });
	},
);

export const personUpsert = inngest.createFunction(
	{
		id: 'sanity/person.upsert',
		description:
			'If a valid user is supplied, updates a Person in Sanity. Otherwise, creates a new Person.',
	},
	{ event: 'sanity/person.upsert' },
	async function ({ event }) {
		if (!event.data.user) {
			return createPerson(
				event.data.name,
				event.data.user_id,
				event.data.username,
				event.data.avatar,
			);
		} else {
			return updatePersonFromClerk(event.data.user._id, {
				name: event.data.name,
				username: event.data.username,
				avatar: event.data.avatar,
			});
		}
	},
);

export const personUpdateDetails = inngest.createFunction(
	{ id: 'sanity/person.details.update' },
	{ event: 'sanity/person.details.update' },
	async ({ event, step }) => {
		const { id, bio, links } = event.data;

		return step.run('sanity/person.details.update', async () => {
			return updatePerson(id, { bio, links });
		});
	},
);

export const personUpdateSubscription = inngest.createFunction(
	{ id: 'sanity/person.subscription.update' },
	{ event: 'sanity/person.subscription.update' },
	async ({ event, step }) => {
		return step.run('sanity/update-subscription-details', async () => {
			return updatePersonSubscription(event.data.sanityUserId, {
				customer: event.data.stripeCustomerId,
				status: event.data.subscriptionStatus,
				level: event.data.productName,
				date: new Date(),
			});
		});
	},
);
