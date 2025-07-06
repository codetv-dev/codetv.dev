import { DISCORD_BOT_TOKEN } from 'astro:env/server';

// TODO probably put these in the env?
export const DISCORD_SERVER_ID = '936836444503310426';
export const DISCORD_CHANNEL_ID = '1063702581567828008'; // #bot-testing

export type SubscriptionLevel = 'Free Tier Supporter' | 'Silver Tier Supporter' | 'Gold Tier Supporter' | 'Platinum Tier Supporter';

export const botRequestHeaders = {
	Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
	'Content-Type': 'application/json',
	'User-Agent': 'CodeTV Bot (http://www.codetv.dev, v0.1)',
};

export const roles = {
	FREE_TIER_ROLE_ID: '1391513313258504213',
  SILVER_TIER_ROLE_ID: '1388646332721270864',
  GOLD_TIER_ROLE_ID: '1388646061572096170',
  PLATINUM_TIER_ROLE_ID: '1364315006287740948',
};

export function getRoleId(plan: SubscriptionLevel) {
  switch (plan) {
    case 'Silver Tier Supporter':
      return roles.SILVER_TIER_ROLE_ID;
    
    case 'Gold Tier Supporter':
      return roles.GOLD_TIER_ROLE_ID;

    case 'Platinum Tier Supporter':
      return roles.PLATINUM_TIER_ROLE_ID;

		default:
			return roles.FREE_TIER_ROLE_ID;
  }
}

export async function sendDiscordMessage({ content }: { content: string }) {
	const res = await fetch(
		`https://discord.com/api/v10/channels/${DISCORD_CHANNEL_ID}/messages`,
		{
			method: 'POST',
			headers: botRequestHeaders,
			body: JSON.stringify({
				content,
			}),
		},
	);

	if (!res.ok) {
		throw new Error(res.statusText);
	}

	const data = await res.json();

	return data;
}

export async function updateRole({ memberId, roleId }: {
	memberId: string;
	roleId: string;
}) {
	const res = await fetch(
		`https://discord.com/api/v10/guilds/${DISCORD_SERVER_ID}/members/${memberId}/roles/${roleId}`,
		{
			method: 'PUT',
			headers: botRequestHeaders,
		},
	);

	if (!res.ok) {
		console.log(res);
		throw new Error(res.statusText);
	}
	
	return res;
}
