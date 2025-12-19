import { NonRetriableError } from 'inngest';
import { inngest } from '../../client.js';
import {
	addMemberToGuild,
	addRoleIfMissing,
	getMember,
	getRoleId,
	removeRole,
	sendDiscordMessage,
} from '@codetv/discord';
import { type SubscriptionLevel } from '@codetv/types';
import { config } from './config.ts';
import { userGetById, userGetOAuthToken } from '../clerk/steps.ts';

export const messageSend = inngest.createFunction(
	{ id: 'discord/message.send' },
	{ event: 'discord/message.send' },
	async function ({ event, step }) {
		await step.run('discord/message.send', async () => {
			await sendDiscordMessage({
				content: event.data.message,
			});
		});
	},
);

export const getDiscordMemberId = inngest.createFunction(
	{ id: 'discord/user.id.get' },
	{ event: 'discord/user.id.get' },
	async function ({ event, step }) {
		const user = event.data.user;

		return step.run('clerk/user.external-account.get-id', async () => {
			const discord = user.externalAccounts.find(
				(acct) => acct.provider === 'oauth_discord',
			);

			if (!discord) {
				throw new NonRetriableError('no Discord account', discord);
			}

			return discord.externalId;
		});
	},
);


export const addMemberToServer = inngest.createFunction(
	{ id: 'discord/guild.member.add' },
	[{ event: 'discord/guild.member.add' }],
	async function ({ event, step }) {
		const { memberId, userId } = event.data;

		const access_token = await step.invoke('get-discord-user-oauth-token', {
			function: userGetOAuthToken,
			data: {
				provider: 'discord',
				userId,
			},
		});

		return step.run('add-member-to-discord-server', async () => {
			return addMemberToGuild({ memberId, access_token });
		});
	},
);

export type BadgeType = 'hackathon_participant';



/**
 * Consolidated function for adding roles to Discord users.
 * Handles both alumni roles (by userId) and badge roles (by memberId).
 */
export const updateUserRole = inngest.createFunction(
	{ id: 'discord/user.role.add' },
	{ event: 'discord/user.role.add' },
	async function ({ event, step }) {
		const data = event.data;

		// Get the role ID from config
		const roleId = config.roles[data.role];
		if (!roleId) {
			throw new NonRetriableError(`Unknown role: ${data.role}`);
		}

		if (data.type === 'alumni') {
			// Alumni flow: userId -> get user -> get memberId -> ensure in server -> add role
			const user = await step.invoke('get-current-user', {
				function: userGetById,
				data: { userId: data.userId },
			});

			const memberId = await step.invoke('discord-get-user-id', {
				function: getDiscordMemberId,
				data: { user },
			});

			const discordMember = await step.run('discord/user.get', async () => {
				return getMember(memberId);
			});

			await step.invoke('discord-add-user-to-server', {
				function: addMemberToServer,
				data: { userId: data.userId, memberId },
			});

			return step.run('discord/user.role.apply', async () => {
				return addRoleIfMissing({ memberId, roleId, member: discordMember });
			});
		} else {
			// Badge flow: memberId -> check if in server -> add role (skip if not in server)
			const discordMember = await step.run('discord/user.get', async () => {
				try {
					return await getMember(data.memberId);
				} catch {
					return null;
				}
			});

			if (!discordMember) {
				return {
					message: `User ${data.memberId} is not in the server, skipping role`,
				};
			}

			return step.run('discord/user.role.apply', async () => {
				return addRoleIfMissing({
					memberId: data.memberId,
					roleId,
					member: discordMember,
				});
			});
		}
	},
);

export const discordUpdateUserRole = inngest.createFunction(
	{ id: 'discord/update-user-role' },
	[{ event: 'clerk/user.created' }, { event: 'clerk/user.updated' }],
	async function ({ event, step }) {
		const userId = event.data.id;

		const user = await step.invoke('discord-get-user', {
			function: userGetById,
			data: {
				userId,
			},
		});

		const roleId = await step.run('discord/user.role.get-id', async () => {
			// TODO centralize types to avoid this problem
			// @ts-expect-error not dealing with this
			let level = (user.publicMetadata.stripe?.level ??
				'Free Tier Supporter') as SubscriptionLevel;

			return getRoleId(level);
		});

		const memberId = await step.invoke('discord-get-user-id', {
			function: getDiscordMemberId,
			data: {
				user,
			},
		});

		const discordMember = await step.run('discord/user.get', async () => {
			return getMember(memberId);
		});

		// update the user's role on Discord
		const maybeAddRolePromise = step.run('discord/user.roles.add', async () => {
			return addRoleIfMissing({ memberId, roleId, member: discordMember });
		});

		// remove other roles on Discord
		const maybeRemoveSilverPromise = step.run(
			'discord/user.roles.maybe-remove-silver',
			async () => {
				if (
					discordMember.roles.includes(config.roles.silver) &&
					roleId !== config.roles.silver
				) {
					return removeRole({
						memberId,
						roleId: config.roles.silver,
					});
				}

				return {
					message: 'silver role removal: no action',
				};
			},
		);

		const maybeRemoveGoldPromise = step.run(
			'discord/user.roles.maybe-remove-gold',
			async () => {
				if (
					discordMember.roles.includes(config.roles.gold) &&
					roleId !== config.roles.gold
				) {
					return removeRole({
						memberId,
						roleId: config.roles.gold,
					});
				}

				return {
					message: 'gold role removal: no action',
				};
			},
		);

		const maybeRemovePlatinumPromise = step.run(
			'discord/user.roles.maybe-remove-platinum',
			async () => {
				if (
					discordMember.roles.includes(config.roles.platinum) &&
					roleId !== config.roles.platinum
				) {
					return removeRole({
						memberId,
						roleId: config.roles.platinum,
					});
				}

				return {
					message: 'platinum role removal: no action',
				};
			},
		);

		await Promise.all([
			maybeAddRolePromise,
			maybeRemoveSilverPromise,
			maybeRemoveGoldPromise,
			maybeRemovePlatinumPromise,
		]);

		// TODO only send this message when the role is actually added above
		// send a message to the updates feed channel
		await step.invoke('send-discord-message', {
			function: messageSend,
			data: {
				message: `granted <@${memberId}> the <@&${roleId}> role`,
			},
		});
	},
);
