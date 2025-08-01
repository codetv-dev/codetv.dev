import jwt from 'jsonwebtoken';
import { config } from '../config.ts';

// our service account needs these scopes to view/change data
const scopes = [
	'https://www.googleapis.com/auth/spreadsheets',
	'https://www.googleapis.com/auth/calendar',
];

export async function getGoogleAccessToken() {
	const iat = Math.floor(Date.now() / 1000);
	const exp = iat + 3600;

	if (!config.auth.privateKey) {
		throw new Error('must set GOOGLE_API_PRIVATE_KEY in env');
	}

	const jwtToken = jwt.sign(
		{
			iss: process.env.GOOGLE_API_SERVICE_ACCOUNT ?? config.auth.serviceAccount,
			scope: scopes.join(' '),
			aud: 'https://accounts.google.com/o/oauth2/token',
			exp,
			iat,
		},
		process.env.GOOGLE_API_PRIVATE_KEY ?? config.auth.privateKey,
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
