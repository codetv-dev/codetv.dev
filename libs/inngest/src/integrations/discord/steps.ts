import { NonRetriableError } from 'inngest';
import { inngest } from '../../client.js';
import {
	getMember,
	getRoleId,
	removeRole,
	sendDiscordMessage,
	updateRole,
} from '@codetv/discord';
import { type SubscriptionLevel } from '@codetv/types';
import { config } from './config.ts';
import { userGetById } from '../clerk/steps.ts';

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

		const memberId = await step.run(
			'clerk/user.external-account.get-id',
			async () => {
				const discord = user.externalAccounts.find(
					(acct) => acct.provider === 'oauth_discord',
				);

				if (!discord) {
					throw new NonRetriableError('no Discord account', discord);
				}

				return discord.externalId;
			},
		);

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
