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
		`https://sheets.googleapis.com/v4/spreadsheets/${config.sheets.filming.id}/values/${config.sheets.filming.range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
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

	return `https://docs.google.com/spreadsheets/d/${config.sheets.filming.id}/edit`;
}

export async function appendValueForHackathon({
	email,
	fullName,
	githubRepo,
	deployedApp,
	tocAgreement,
	doNotShare,
}: {
	email: string;
	fullName: string;
	githubRepo: string;
	deployedApp: string;
	tocAgreement: boolean;
	doNotShare: boolean;
}) {
	const accessToken = await getGoogleAccessToken();

	const entry = [
		new Date().toLocaleString(),
		email,
		fullName,
		githubRepo,
		deployedApp,
		tocAgreement,
		doNotShare,
	];

	const res = await fetch(
		`https://sheets.googleapis.com/v4/spreadsheets/${config.sheets.hackathon.id}/values/${config.sheets.hackathon.range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
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

	return `https://docs.google.com/spreadsheets/d/${config.sheets.hackathon.id}/edit`;
}
