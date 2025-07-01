import { DISCORD_BOT_TOKEN } from 'astro:env/server';
import { clerk } from '../../util/clerk';
import type { APIRoute } from 'astro';

// TODO probably put these in the env?
const DISCORD_SERVER_ID = '936836444503310426';

type SubscriptionLevel = 'Silver Tier Supporter' | 'Gold Tier Supporter' | 'Platinum Tier Supporter';

function getRoleId(plan: SubscriptionLevel) {
  const SILVER_TIER_ROLE_ID = '1388646332721270864';
  const GOLD_TIER_ROLE_ID = '1388646061572096170';
  const PLATINUM_TIER_ROLE_ID = '1364315006287740948';

  switch (plan) {
    case 'Silver Tier Supporter':
      return SILVER_TIER_ROLE_ID;
    
    case 'Gold Tier Supporter':
      return GOLD_TIER_ROLE_ID;

    case 'Platinum Tier Supporter':
      return PLATINUM_TIER_ROLE_ID;
  }
}

export const GET: APIRoute = async ({ locals }) => {
	const { userId } = locals.auth();

	if (!userId) {
		return new Response('Unauthorized', { status: 401 });
	}

	const user = await clerk.users.getUser(userId);

  if (!user.publicMetadata.stripe || !user.publicMetadata.stripe.status) {
    return new Response('user does not have an active subscription');
  }

  const roleId = getRoleId(user.publicMetadata.stripe.level as SubscriptionLevel);

	const discordAcct = user.externalAccounts.find(
		(acct) => acct.provider === 'oauth_discord',
	);

	if (discordAcct) {
		const discordId = discordAcct.externalId;

    if (!discordId) {
      console.log(JSON.stringify(discordAcct, null, 2));
    }

    const r = await fetch(
      `https://discord.com/api/v10/oauth2/applications/@me`,
			{
				method: 'GET',
				headers: {
					Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
					'Content-Type': 'application/json',
					'User-Agent': 'CodeTV Bot (http://www.codetv.dev, v0.1)',
				},
			},
    );

		if (!r.ok) {
      console.log(r);
			throw new Error(r.statusText);
		}

    console.log(await r.json());

		const res = await fetch(
			`https://discord.com/api/v10/guilds/${DISCORD_SERVER_ID}/members/${discordId}/roles/${roleId}`,
			{
				method: 'PUT',
				headers: {
					Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
				},
			},
		);

		if (!res.ok) {
      console.log(res);
			throw new Error(res.statusText);
		}

    const msgRes = await fetch(
      'https://discord.com/api/v10/channels/1063702581567828008/messages',
      {
        method: 'POST',
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          'Content-Type': 'application/json',
          'User-Agent': 'CodeTV Bot (http://www.codetv.dev, v0.1)',
        },
        body: JSON.stringify({
          content: `granted <@${discordId}> the <@&${roleId}> role`,
        }),
      },
    );
  
    if (!msgRes.ok) {
      throw new Error(msgRes.statusText);
    }
  
    const data = await msgRes.json();
  
    return new Response(JSON.stringify(data));
	}

  return new Response(JSON.stringify("Discord not connected"))
}
