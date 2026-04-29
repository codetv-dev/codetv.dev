import type { APIRoute } from 'astro';

const alphabet = 'ABCDEFGHIJKLMNOP';
const nanoid = () =>
	Array.from(
		crypto.getRandomValues(new Uint8Array(6)),
		(value) => alphabet[value % alphabet.length],
	).join('');

export const POST: APIRoute = async () =>
	Response.json(
		{
			client_id: nanoid(),
			client_secret: nanoid(),
		},
		{ status: 201 },
	);
