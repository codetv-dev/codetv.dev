import { defineAction } from 'astro:actions';
import { z } from 'astro:content';
import { inngest } from '@codetv/inngest';
import { addSubscriber } from '@codetv/kit';

export const server = {
	user: {
		updateProfile: defineAction({
			accept: 'form',
			handler: async (formData) => {
				const linkLabels = formData.getAll('link_label[]');
				const linkUrls = formData.getAll('link_url[]');
				const links = linkUrls
					.map((url, i) => {
						if (!url) {
							return false;
						}

						return {
							label: linkLabels.at(i) ?? '',
							url,
						};
					})
					.filter((val) => val !== false);

				const rawInput = {
					id: formData.get('id'),
					username: formData.get('username'),
					bio: formData.get('bio') ?? '',
					links,
				};

				const schema = z.object({
					id: z.string(),
					username: z.string(),
					bio: z.string(),
					links: z.array(
						z.object({
							label: z.string(),
							url: z.string(),
						}),
					),
				});

				const data = schema.parse(rawInput);

				try {
					await inngest.send({
						name: 'codetv/user.profile.update',
						data,
					});

					return data;
				} catch (err) {
					console.log({ err });
				}
			},
		}),
		addToDiscord: defineAction({
			async handler(_, context) {
				const user = await context.locals.currentUser();

				if (!user) {
					return false;
				}

			await inngest.send({
				name: 'discord/user.role.add',
				data: {
					type: 'alumni',
					userId: user.id,
					role: 'wdc_alumni',
				},
			});

				return true;
			},
		}),
	},
	forms: {
		wdc: defineAction({
			accept: 'form',
			handler: async (formData) => {
				const linkLabels = formData.getAll('link_label[]');
				const linkUrls = formData.getAll('link_url[]');
				const links = linkUrls
					.map((url, i) => {
						if (!url) {
							return false;
						}

						return {
							label: linkLabels.at(i) ?? '',
							url,
						};
					})
					.filter((val) => val !== false);

				const rawInput = {
					signature: formData.get('signature'),
					role: formData.get('role'),
					reimbursement: formData.get('reimbursement'),
					email: formData.get('email'),
					phone: formData.get('phone'),
					groupchat: formData.get('groupchat'),
					bio: formData.get('bio') ?? '',
					links,
					dietaryRequirements: formData.get('dietaryRequirements') ?? '',
					foodAdventurousness: formData.get('foodAdventurousness'),
					coffee: formData.get('coffee') ?? '',
					id: formData.get('id'),
					username: formData.get('username'),
				};

				const InputSchema = z.object({
					signature: z.string(),
					role: z.union([z.literal('developer'), z.literal('advisor')]),
					reimbursement: z.coerce.boolean(),
					email: z.string(),
					phone: z.string(),
					groupchat: z.coerce.boolean(),
					bio: z.string().optional(),
					links: z.array(
						z.object({
							label: z.string(),
							url: z.string(),
						}),
					),
					dietaryRequirements: z.string().optional(),
					foodAdventurousness: z.coerce.number(),
					coffee: z.string().optional(),
					id: z.string(),
					username: z.string(),
				});

				const data = InputSchema.parse(rawInput);

				try {
					await inngest.send({
						name: 'codetv/forms.wdc.submit',
						data,
					});

					return data;
				} catch (err) {
					console.log({ err });
					return {
						error: err,
					};
				}
			},
		}),
		lwj: defineAction({
			async handler(_, context) {
				const user = await context.locals.currentUser();

				if (!user) {
					return false;
				}

				const { ids } = await inngest.send({
					name: 'codetv/forms.lwj.book',
				});

				return ids;
			},
		}),
	},
	newsletter: {
		subscribe: defineAction({
			accept: 'json',
			handler: async (input) => {
				const schema = z.object({
					firstName: z.string(),
					email: z.string().email(),
				});

				const { firstName, email } = schema.parse(input);

				const subscriber = await addSubscriber(firstName, email);

				return subscriber;
			},
		}),
	},
};
