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

// Consolidated role types for updateUserRole
export const AlumniRole = z.enum([
	'wdc_alumni',
	'lh_alumni',
	'lwj_alumni',
]);

export const BadgeRole = z.enum([
	'hackathon_participant',
]);

export const UserRoleUpdate = z.discriminatedUnion('type', [
	z.object({
		type: z.literal('alumni'),
		userId: z.string(),
		role: AlumniRole,
	}),
	z.object({
		type: z.literal('badge'),
		memberId: z.string(),
		role: BadgeRole,
	}),
]);

export type UserRoleUpdateData = z.infer<typeof UserRoleUpdate>;

export const schema = {
	'discord/user.role.add': {
		data: UserRoleUpdate,
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
};
