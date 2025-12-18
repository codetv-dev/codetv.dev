import { getGoogleAccessToken } from './auth.ts';
import { config } from '../config.ts';

/**
 * Generic helper to append a row to a Google Sheet
 * @param sheetId - The Google Sheet ID
 * @param range - The range to append to (e.g., 'Sheet1!A2')
 * @param values - Array of values to append (timestamp is prepended automatically)
 * @returns Sheet URL or error object
 */
async function appendToSheet(
	sheetId: string,
	range: string,
	values: (string | number | boolean | undefined)[],
) {
	const accessToken = await getGoogleAccessToken();

	const entry = [new Date().toLocaleString(), ...values];

	const res = await fetch(
		`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
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
		const errorBody = await res.json().catch(() => null);
		return {
			error: {
				status: res.status,
				statusText: res.statusText,
				details: errorBody,
			},
		};
	}

	return `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
}

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
	return appendToSheet(config.sheet.id, config.sheet.range, [
		signature,
		role,
		reimbursement,
		email,
		phone,
		groupchat,
		dietaryRequirements,
		foodAdventurousness,
		coffee,
	]);
}

export async function appendHackathonValue({
	userId,
	fullName,
	email,
	githubRepo,
	deployedUrl,
	agreeTerms,
	optOutSponsorship,
}: {
	userId: string;
	fullName: string;
	email: string;
	githubRepo: string;
	deployedUrl: string;
	agreeTerms: boolean;
	optOutSponsorship: boolean;
}) {
	return appendToSheet(config.hackathonSheet.id, config.hackathonSheet.range, [
		fullName,
		email,
		githubRepo,
		deployedUrl,
		agreeTerms,
		optOutSponsorship,
	]);
}
