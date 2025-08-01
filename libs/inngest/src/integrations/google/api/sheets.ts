import { getGoogleAccessToken } from './auth.ts';
import { config } from '../config.ts';

export async function appendValue({
	signature,
	role,
	reimbursement,
	email,
	phone,
	groupchat,
	dietaryRequirements,
	foodAdventurousness,
	coffee,
}: {
	signature: string;
	role: string;
	reimbursement: boolean;
	email: string;
	phone: string;
	groupchat: boolean;
	dietaryRequirements?: string;
	foodAdventurousness: number;
	coffee?: string;
}) {
	const accessToken = await getGoogleAccessToken();

	const entry = [
		new Date().toLocaleString(),
		signature,
		role,
		reimbursement,
		email,
		phone,
		groupchat,
		dietaryRequirements,
		foodAdventurousness,
		coffee,
	];

	const res = await fetch(
		`https://sheets.googleapis.com/v4/spreadsheets/${config.sheet.id}/values/${config.sheet.range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
		{
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${accessToken}`,
			},
			body: JSON.stringify({
				values: [entry],
			}),
		},
	);

	if (!res.ok) {
		return {
			error: {
				status: res.status,
				statusText: res.statusText,
			},
		};
	}

	return `https://docs.google.com/spreadsheets/d/${config.sheet.id}/edit`;
}
