import { join } from 'node:path';
import {
	GOOGLE_SHEETS_SERVICE_ACCOUNT,
} from 'astro:env/server';
import { decrypt } from '@tka85/dotenvenc';
import jwt from 'jsonwebtoken';

const env = await decrypt({
	passwd: process.env.DOTENVENC_PASS,
	encryptedFile: join(process.cwd(), '.env.enc'),
});

const SHEET_ID = '1ihOfKXacyKDmarkq1yrwSpodRvfncS-xpXSVJP5Zrnw';
const SHEET_RANGE = 'Sheet1!A2';

async function getGoogleSheetsAccessToken() {
	const iat = Math.floor(Date.now() / 1000);
	const exp = iat + 3600;
	const jwtToken = jwt.sign(
		{
			iss: GOOGLE_SHEETS_SERVICE_ACCOUNT,
			scope: 'https://www.googleapis.com/auth/spreadsheets',
			aud: 'https://accounts.google.com/o/oauth2/token',
			exp,
			iat,
		},
		env.GOOGLE_SHEETS_PRIVATE_KEY,
		{ algorithm: 'RS256' },
	);

	const { access_token } = await fetch(
		'https://accounts.google.com/o/oauth2/token',
		{
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: new URLSearchParams({
				grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
				assertion: jwtToken,
			}),
		},
	).then((response) => response.json());

	return access_token;
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
	const accessToken = await getGoogleSheetsAccessToken();

	// const fieldOrder = [
  //  'Date Submitted',
	// 	'Video Release Signature',
  //   'Role',
	// 	'Booking Reimbursement Confirmed',
	// 	'Email',
	// 	'Phone',
  //   'Groupchat Approval',
	// 	'Dietary requirements',
	// 	'Food Adventurousness',
	// 	'Coffee Order',
	// ];

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
  ]

	const res = await fetch(
		`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${SHEET_RANGE}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
		{
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${accessToken}`,
			},
			body: JSON.stringify({
				values: [ entry ],
			}),
		},
	);

	if (!res.ok) {
		return {
			token: accessToken,
			error: {
				status: res.status,
				statusText: res.statusText,
			},
		};
	}

  const { spreadsheetId } = await res.json();

  if (!spreadsheetId) {
    throw new Error('no spreadsheet ID returned');
  }

	return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
}
