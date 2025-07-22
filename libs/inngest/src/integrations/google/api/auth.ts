import { join } from 'node:path';
import { decrypt } from '@tka85/dotenvenc';
import jwt from 'jsonwebtoken';

// This little maneuver happens because `process.cwd()` gives different
// output locally than it does on Netlify, and we need to make sure to strip
// out the extra path bits so we have a real path in both places.
// I do not like this.
const path = join(process.cwd(), 'apps/workflows', '.env.enc')
	.replace('apps/website/', '')
	.replace('apps/workflows/apps/workflows', 'apps/workflows');

const env = await decrypt({
	passwd: process.env.DOTENVENC_PASS,
	encryptedFile: path,
});

// our service account needs these scopes to view/change data
const scopes = [
	'https://www.googleapis.com/auth/spreadsheets',
	'https://www.googleapis.com/auth/calendar',
];

export async function getGoogleAccessToken() {
	const iat = Math.floor(Date.now() / 1000);
	const exp = iat + 3600;

	if (!env.GOOGLE_API_PRIVATE_KEY) {
		throw new Error('must set GOOGLE_API_PRIVATE_KEY in env');
	}

	const jwtToken = jwt.sign(
		{
			iss: process.env.GOOGLE_API_SERVICE_ACCOUNT,
			scope: scopes.join(' '),
			aud: 'https://accounts.google.com/o/oauth2/token',
			exp,
			iat,
		},
		env.GOOGLE_API_PRIVATE_KEY,
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
