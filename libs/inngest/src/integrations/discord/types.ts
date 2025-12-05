import { z } from 'zod';
import { ClerkWebhookUser } from '@codetv/clerk';

export const ClerkUser = z.object({
	id: z.string(),
	username: z.string().nullable(),
	firstName: z.string().nullable(),
	lastName: z.string().nullable(),
	externalAccounts: z.array(
		z.object({
			id: z.string(),
			provider: z.string(),
			externalId: z.string(),
			approvedScopes: z.string(),
			username: z.string().nullable(),
		}),
	),
});

export const schema = {
	'discord/user.alumni-role.add': {
		data: z.object({
			userId: z.string(),
			role: z.union([
				z.literal('Web Dev Challenge Alumni'),
				z.literal('Leet Heat Alumni'),
				z.literal('Learn With Jason Alumni'),
			]),
		}),
	},
	'discord/guild.member.add': {
		data: z.object({
			userId: z.string(),
			memberId: z.string(),
		}),
	},
	'discord/user.id.get': {
		data: z.object({
			user: ClerkUser,
		}),
	},
	'discord/user.role.update': {
		data: ClerkWebhookUser,
	},
	'discord/message.send': {
		data: z.object({
			message: z.string(),
		}),
	},
	'discord/user.badge.add': {
		data: z.object({
			memberId: z.string(),
			badge: z.literal('hackathon_participant'),
		}),
	},
};
