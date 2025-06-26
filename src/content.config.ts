import { glob } from 'astro/loaders';
import { defineCollection, z } from 'astro:content';
import { getAllUsers } from './util/sanity';

const blog = defineCollection({
	loader: glob({ pattern: '**/*.mdx', base: './src/content/blog' }),
	schema: z.object({
		draft: z.boolean().default(false).optional(),
		pubDate: z.date(),
		updated: z.date().optional(),
		title: z.string(),
		description: z.string(),
		share: z
			.object({
				title: z.string().optional(),
				image: z.string().url().optional(),
				text: z.string().optional(),
			})
			.optional(),
		showOptin: z.boolean().default(true).optional(),
	}),
});

const profiles = defineCollection({
	loader: async () => {
		const users = await getAllUsers();

		return users.map((u) => ({ id: u.slug!, ...u }));
	},
	schema: z.object({
		_id: z.string(),
		name: z.string(),
		slug: z.string(),
		bio: z
			.string()
			.nullish()
			.transform((x) => x ?? undefined),
		photo: z
			.object({
				public_id: z.string(),
				height: z.number(),
				width: z.number(),
			})
			.nullish()
			.transform((x) => x ?? undefined),
		subscription: z
			.object({
				cus_id: z.string().nullish(),
				level: z.string().nullish(), // TODO probably a union here?
				status: z.string().nullish(), // TODO probably a union here too?
			})
			.nullish(),
		user_id: z.string().nullish(),
		links: z
			.array(
				z.object({
					label: z.string(),
					url: z.string().url(),
				}),
			)
			.nullish(),
		episodes: z
			.array(
				z.object({
					title: z.string(),
					slug: z.string(),
					short_description: z.string(),
					publish_date: z.coerce.date(),
					thumbnail: z
						.object({
							public_id: z.string().nullish(),
							alt: z.string().nullish(),
							width: z.number().nullish(),
							height: z.number().nullish(),
						})
						.nullish(),
					video: z.object({
						youtube_id: z
							.string()
							.nullish()
							.transform((x) => x ?? undefined),
					}),
					collection: z.object({
						slug: z.string(),
						title: z.string(),
						episodeSlugs: z.array(z.string()),
					}),
					series: z.object({
						slug: z.string(),
						title: z.string(),
					}),
				}),
			)
			.default([]),
	}),
});

export const collections = {
	blog,
	profiles,
};
