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

export const HackathonSubmission = z.object({
	userId: z.string(),
	email: z.string(),
	fullName: z.string(),
	githubRepo: z.string(),
	deployedUrl: z.string(),
	agreeTerms: z.boolean(),
	optOutSponsorship: z.boolean(),
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
	'codetv/forms.lwj.book': {},
	'codetv/forms.hackathon.submission': {
		data: HackathonSubmission,
	},
	'codetv/test-confirmation': {
		data: z.object({
			confirmationUUid: z.string(),
			message: z.string(),
		}),
	},
};
