import { z } from 'zod';
import { type SubscriptionLevel } from '@codetv/types';
import { config } from './config.ts';

export function getRoleId(plan: SubscriptionLevel) {
	switch (plan) {
		case 'Silver Tier Supporter':
			return config.roles.silver;

		case 'Gold Tier Supporter':
			return config.roles.gold;

		case 'Platinum Tier Supporter':
			return config.roles.platinum;

		default:
			return config.roles.free;
	}
}

export async function getMember(memberId: string) {
	const res = await fetch(
		`https://discord.com/api/v10/guilds/${config.serverID}/members/${memberId}`,
		{
			method: 'GET',
			headers: config.headers,
		},
	);

	if (!res.ok) {
		throw new Error(res.statusText);
	}

	const data = await res.json();

	const schema = z.object({
		roles: z.array(z.string()),
		user: z.object({
			id: z.string(),
			username: z.string(),
		}),
	});

	return schema.parse(data);
}

export async function sendDiscordMessage({ content }: { content: string }) {
	const res = await fetch(
		`https://discord.com/api/v10/channels/${config.channelID}/messages`,
		{
			method: 'POST',
			headers: config.headers,
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

export async function addMemberToGuild({
	memberId,
	access_token,
}: {
	memberId: string;
	access_token: string;
}) {
	console.log({
		url: `https://discord.com/api/v10/guilds/${config.serverID}/members/${memberId}`,
		method: 'PUT',
		headers: config.headers,
		body: JSON.stringify({ access_token }),
	});

	const res = await fetch(
		`https://discord.com/api/v10/guilds/${config.serverID}/members/${memberId}`,
		{
			method: 'PUT',
			headers: config.headers,
			body: JSON.stringify({ access_token }),
		},
	);

	if (!res.ok) {
		console.log(res);
		throw new Error(res.statusText);
	}

	return res;
}

export async function updateRole({
	memberId,
	roleId,
}: {
	memberId: string;
	roleId: string;
}) {
	const res = await fetch(
		`https://discord.com/api/v10/guilds/${config.serverID}/members/${memberId}/roles/${roleId}`,
		{
			method: 'PUT',
			headers: config.headers,
		},
	);

	if (!res.ok) {
		console.log(res);
		throw new Error(res.statusText);
	}

	return res;
}

export async function removeRole({
	memberId,
	roleId,
}: {
	memberId: string;
	roleId: string;
}) {
	const res = await fetch(
		`https://discord.com/api/v10/guilds/${config.serverID}/members/${memberId}/roles/${roleId}`,
		{
			method: 'DELETE',
			headers: config.headers,
		},
	);

	if (!res.ok) {
		console.log(res);
		throw new Error(res.statusText);
	}

	return res;
}

/**
 * Adds a role to a member if they don't already have it.
 * Returns a result object indicating whether the role was added or already existed.
 */
export async function addRoleIfMissing({
	memberId,
	roleId,
	member,
}: {
	memberId: string;
	roleId: string;
	/** Optional pre-fetched member data to avoid redundant API call */
	member?: { roles: string[]; user: { id: string; username: string } };
}): Promise<{ added: boolean; message: string }> {
	const discordMember = member ?? (await getMember(memberId));

	if (discordMember.roles.includes(roleId)) {
		return {
			added: false,
			message: `${discordMember.user.username} already has role ${roleId}`,
		};
	}

	await updateRole({ memberId, roleId });
	return {
		added: true,
		message: `Added role ${roleId} to ${discordMember.user.username}`,
	};
}
