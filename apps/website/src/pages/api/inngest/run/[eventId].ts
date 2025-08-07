import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ params }) => {
	const response = await fetch(
		`http://localhost:8288/v1/events/${params.eventId}/runs`,
		{
			headers: {
				Authorization: `Bearer ${process.env.INNGEST_SIGNING_KEY}`,
			},
		},
	);
	const json = await response.json();

	console.log(json);

	return new Response(JSON.stringify(json.data));
};
