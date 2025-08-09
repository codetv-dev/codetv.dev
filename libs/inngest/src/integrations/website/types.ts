import z from 'zod';

export const WebDevChallengeFormSubmit = z.object({
	id: z.string(),
	username: z.string(),
	bio: z.string().optional(),
	email: z.string(),
	phone: z.string(),
	groupchat: z.boolean(),
	dietaryRequirements: z.string().optional(),
	foodAdventurousness: z.number(),
	coffee: z.string().optional(),
	signature: z.string(),
	role: z.union([z.literal('developer'), z.literal('advisor')]),
	reimbursement: z.boolean(),
	links: z.array(z.object({ label: z.string(), url: z.string() })),
});

export const WebDevChallengeHackathonSubmit = z.object({
	id: z.string(),
	username: z.string(),
	email: z.string(),
	fullName: z.string(),
	githubRepo: z.string(),
	deployedApp: z.string(),
	tocAgreement: z.boolean(),
	doNotShare: z.boolean(),
});

export const schema = {
	'codetv/user.profile.update': {
		data: z.object({
			id: z.string(),
			username: z.string(),
			bio: z.string(),
			links: z.array(z.object({ label: z.string(), url: z.string() })),
		}),
	},
	'codetv/forms.wdc.submit': {
		data: WebDevChallengeFormSubmit,
	},
	'codetv/forms.wdc.hackathon': {
		data: WebDevChallengeHackathonSubmit,
	},
	'codetv/forms.lwj.book': {},
	'codetv/test-confirmation': {
		data: z.object({
			confirmationUUid: z.string(),
			message: z.string(),
		}),
	},
};
