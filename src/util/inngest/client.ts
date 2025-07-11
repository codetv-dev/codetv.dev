import { EventSchemas, Inngest } from 'inngest';

type ClerkWebhookUser = {
	data: {
		id: string;
		username: string;
		first_name: string;
		last_name: string;
		profile_image_url: string;
	};
};

type Events = {
	'clerk/user.updated': ClerkWebhookUser;
	'clerk/user.created': ClerkWebhookUser;
	'internal/stripe.subscription.retrieve': {
		data: {
			subscriptionId: string;
		};
	};
	'internal/stripe.product.retrieve': {
		data: {
			productId: string;
		};
	};
	'internal/clerk.user.update-subscription': {
		data: {
			clerkUserId: string;
			stripeCustomerId: string;
			subscriptionStatus: string;
			productName: string;
		};
	};
	'internal/sanity.person.update-subscription': {
		data: {
			sanityUserId: string;
			stripeCustomerId: string;
			subscriptionStatus: string;
			productName: string;
		};
	};
	'internal/netlify.cache-tag.invalidate': {
		data: {
			cacheTag: string;
		};
	};
	'internal/discord.user.role.update': ClerkWebhookUser;
	'stripe/checkout.session.completed': {
		data: {
			object: {
				customer: string;
				metadata: {
					userId: string;
				};
				subscription: string;
				cancel_at_period_end: boolean;
			};
		};
	};
	'stripe/customer.subscription.updated': {
		data: {
			object: {
				id: string;
				cancel_at_period_end: boolean;
			};
		};
	};
	'stripe/customer.subscription.deleted': {
		data: {
			object: {
				id: string;
			};
		};
	};
	'codetv/user.profile.update': {
		data: {
			id: string;
			username: string;
			bio: string;
			links: Array<{ label: string; url: string }>;
		};
	};
	'codetv/forms.wdc.submit': {
		data: {
			id: string;
			username: string;
			bio: string;
			email: string;
			phone: string;
			groupchat: boolean;
			dietaryRequirements?: string;
			foodAdventurousness: number;
			coffee?: string;
			terms: string;
			role: 'developer' | 'advisor';
			reimbursement: boolean;
			links: Array<{ label: string; url: string }>;
		}
	}
};

export const schemas = new EventSchemas().fromRecord<Events>();

export const inngest = new Inngest({
	id: 'codetv',
	schemas,
	eventKey: import.meta.env.INNGEST_EVENT_KEY,
});
