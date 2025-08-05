export const config = {
	serverID: '936836444503310426', // CodeTV (often referred to as “guild”)
	channelID: '1063702581567828008', // #bot-testing
	headers: {
		Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
		'Content-Type': 'application/json',
		'User-Agent': 'CodeTV Bot (http://www.codetv.dev, v0.1)',
	},
	roles: {
		free: '1391513313258504213',
		silver: '1388646332721270864',
		gold: '1388646061572096170',
		platinum: '1364315006287740948',
		wdc_alumni: '1270945994015637525',
		lh_alumni: '1388760763853967383',
		lwj_alumni: '1191930314155638804',
	},
};
