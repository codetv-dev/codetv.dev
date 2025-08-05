import { NonRetriableError } from 'inngest';
import { inngest } from '../../client.js';
import {
	addMemberToGuild,
	getMember,
	getRoleId,
	removeRole,
	sendDiscordMessage,
	updateRole,
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

export const addAlumniRole = inngest.createFunction(
	{ id: 'discord/user.alumni-role.add' },
	[{ event: 'discord/user.alumni-role.add' }],
	async function ({ event, step }) {
		const { userId, role } = event.data;

		const user = await step.invoke('get-current-user', {
			function: userGetById,
			data: {
				userId,
			},
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

		const roleId = await step.run('discord/role.get', async () => {
			switch (role) {
				case 'Web Dev Challenge Alumni':
					return config.roles.wdc_alumni;

				case 'Leet Heat Alumni':
					return config.roles.lh_alumni;

				case 'Learn With Jason Alumni':
					return config.roles.lwj_alumni;

				default:
					throw new NonRetriableError('unknown role', role);
			}
		});

		await step.invoke('discord-add-user-to-server', {
			function: addMemberToServer,
			data: {
				userId,
				memberId,
			},
		});

		return step.run('discord/user.roles.add', async () => {
			if (discordMember.roles.includes(roleId)) {
				return {
					message: `${discordMember.user.username} already has role ${roleId}`,
				};
			}

			return updateRole({ memberId, roleId });
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
			if (discordMember.roles.includes(roleId)) {
				return {
					message: `${discordMember.user.username} already has role ${roleId}`,
				};
			}

			return updateRole({ memberId, roleId });
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

		// send a message to the updates feed channel
		await step.invoke('send-discord-message', {
			function: messageSend,
			data: {
				message: `granted <@${memberId}> the <@&${roleId}> role`,
			},
		});
	},
);
