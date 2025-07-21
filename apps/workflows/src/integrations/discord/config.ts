import { DISCORD_BOT_TOKEN } from 'astro:env/server';

export const config = {
	serverID: '936836444503310426', // CodeTV (often referred to as “guild”)
	channelID: '1063702581567828008', // #bot-testing
	headers: {
		Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
		'Content-Type': 'application/json',
		'User-Agent': 'CodeTV Bot (http://www.codetv.dev, v0.1)',
	},
	roles: {
		free: '1391513313258504213',
		silver: '1388646332721270864',
		gold: '1388646061572096170',
		platinum: '1364315006287740948',
	},
};
