import { clerk } from '@codetv/clerk';
import type { APIRoute } from 'astro';
import {
	getRoleId,
	sendDiscordMessage,
	updateRole,
	type SubscriptionLevel,
} from '@codetv/discord';

export const GET: APIRoute = async ({ locals }) => {
	const { userId } = locals.auth();

	if (!userId) {
		return new Response('Unauthorized', { status: 401 });
	}

	const user = await clerk.users.getUser(userId);

	if (!user.publicMetadata.stripe || !user.publicMetadata.stripe.status) {
		return new Response('user does not have an active subscription');
	}

	const roleId = getRoleId(
		user.publicMetadata.stripe.level as SubscriptionLevel,
	);

	const discordAcct = user.externalAccounts.find(
		(acct) => acct.provider === 'oauth_discord',
	);

	if (discordAcct) {
		const memberId = discordAcct.externalId;

		if (!memberId) {
			console.log(JSON.stringify(discordAcct, null, 2));
		}

		const updatedRole = await updateRole({ memberId, roleId });

		console.log(JSON.stringify({ updatedRole }));

		const msgRes = await sendDiscordMessage({
			content: `granted <@${memberId}> the <@&${roleId}> role`,
		});

		return new Response(JSON.stringify({ msgRes }));
	}

	return new Response(JSON.stringify('Discord not connected'));
};
