import { z } from 'zod';

export const schema = {
	'sanity/hackathon.get-current-active': {
		data: z.object({}),
	},
	'sanity/person.get-by-clerk-id': {
		data: z.object({
			clerkUserId: z.string(),
		}),
	},
	'sanity/person.upsert': {
		data: z.object({
			user: z
				.object({
					_id: z.string(),
					name: z.string().nullable(),
					slug: z
						.object({
							_type: z.literal('slug'),
							current: z.string().optional(),
							source: z.string().optional(),
						})
						.nullable(),
					user_id: z.string().nullable(),
				})
				.nullable(),
			user_id: z.string(),
			name: z.string(),
			username: z.string(),
			avatar: z.object({
				public_id: z.string(),
				version: z.number(),
				signature: z.string(),
				width: z.number(),
				height: z.number(),
				format: z.string(),
				resource_type: z.union([
					z.literal('image'),
					z.literal('video'),
					z.literal('raw'),
					z.literal('auto'),
				]),
				created_at: z.string(),
				tags: z.array(z.string()),
				pages: z.number(),
				bytes: z.number(),
				type: z.string(),
				etag: z.string(),
				placeholder: z.boolean(),
				url: z.string(),
				secure_url: z.string(),
				access_mode: z.string(),
				original_filename: z.string(),
				moderation: z.array(z.string()),
				access_control: z.array(z.string()),
				context: z.object({}),
				metadata: z.object({}),
				colors: z.array(z.tuple([z.string(), z.number()])).optional(),
			}),
		}),
	},
	'sanity/person.details.update': {
		data: z.object({
			id: z.string(),
			bio: z.string(),
			links: z.array(z.object({ label: z.string(), url: z.string() })),
		}),
	},
	'sanity/person.subscription.update': {
		data: z.object({
			sanityUserId: z.string(),
			stripeCustomerId: z.string(),
			subscriptionStatus: z.string(),
			productName: z.string(),
		}),
	},
	'sanity/hackathon-submission.create': {
		data: z.object({
			hackathonId: z.string(),
			personId: z.string().optional(),
			email: z.string(),
			fullName: z.string(),
			githubRepo: z.string(),
			deployedUrl: z.string(),
			agreeTerms: z.boolean(),
			optOutSponsorship: z.boolean(),
		}),
	},
};
