import { defineAction } from 'astro:actions';
import { z } from 'astro:content';
import { addSubscriber } from '../util/convertkit';
import { inngest } from '../util/inngest/client';

export const server = {
	user: {
		updateProfile: defineAction({
			accept: 'form',
			input: z.object({
				id: z.string(),
				username: z.string(),
				bio: z.string().optional(),
				'link_label[]': z.array(z.string()),
				'link_url[]': z.array(z.string()),
			}),
			handler: async (input) => {
				const { id, username, bio = '' } = input;
				const link_labels = input['link_label[]'];
				const link_urls = input['link_url[]'];
				const links = link_urls
					.map((url, i) => {
						if (!url) {
							return false;
						}

						return {
							label: link_labels.at(i) ?? '',
							url,
						};
					})
					.filter((val) => val !== false);

				try {
					const result = await inngest.send({
						name: 'codetv/user.profile.update',
						data: {
							id: id.toString(),
							username,
							bio,
							links,
						},
					});

					// TODO figure out how to actually wait for the result
					await new Promise((resolve) => setTimeout(() => resolve(true), 3000));

					return result;
				} catch (err) {
					console.log({ err });
				}
			},
		}),
		wdcIntake: defineAction({
			accept: 'form',
			input: z.object({
				id: z.string(),
				username: z.string(),
				bio: z.string(),
				email: z.string().email(),
				phone: z.string(),
				groupchat: z.boolean(),
				'dietary-requirements': z.string().optional(),
				'food-adventurousness': z.number().int().min(1).max(5),
				coffee: z.string().optional(),
				'terms-accept': z.string(),
				role: z.enum(['developer', 'advisor']),
				reimbursement: z.boolean(),
				'link_label[]': z.array(z.string()),
				'link_url[]': z.array(z.string()),
			}),
			handler: async (input) => {
				console.log('actions.user.wdcIntake');
				console.log(input);
				const {
					id,
					username,
					bio,
					email,
					phone,
					groupchat,
					coffee,
					role,
					reimbursement,
				} = input;

				const dietaryRequirements = input['dietary-requirements'];
				const foodAdventurousness = input['food-adventurousness'];
				const terms = input['terms-accept'];
				const link_labels = input['link_label[]'];
				const link_urls = input['link_url[]'];
				const links = link_urls
					.map((url, i) => {
						if (!url) {
							return false;
						}

						return {
							label: link_labels.at(i) ?? '',
							url,
						};
					})
					.filter((val) => val !== false);

				try {
					const result = await inngest.send({
						name: 'codetv/forms.wdc.submit',
						data: {
							id: id.toString(),
							username,
							email,
							bio,
							phone,
							groupchat,
							coffee,
							role,
							reimbursement,
							dietaryRequirements,
							foodAdventurousness,
							terms,
							links,
						},
					});

					return result;
				} catch (err) {
					console.log({ err });
				}
			},
		}),
	},
	newsletter: {
		subscribe: defineAction({
			accept: 'form',
			input: z.object({
				firstName: z.string(),
				email: z.string().email(),
			}),
			handler: async (input) => {
				const subscriber = await addSubscriber(input.firstName, input.email);

				return subscriber;
			},
		}),
	},
};
