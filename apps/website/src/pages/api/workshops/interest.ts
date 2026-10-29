import type { APIRoute } from 'astro';
import { workshopKit } from '../../../coursebuilder/kit-workshops.ts';
import {
	isInterestSignal,
	workshopMarketing,
} from '../../../coursebuilder/workshop-interest.ts';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
	try {
		// Unknown, malformed or oversized beacons are dropped.
		if (Number(request.headers.get('content-length')) > 1024) return empty();
		const body = await request.text();
		if (body.length > 1024) return empty();
		const { subscriberId, signal, workshop } = JSON.parse(body);
		if (
			!['string', 'number'].includes(typeof subscriberId) ||
			!/^[1-9]\d{0,19}$/.test(String(subscriberId))
		)
			return empty();
		if (
			!isInterestSignal(signal) ||
			!Object.values(workshopMarketing).some(
				(config) => config.pageSlug === workshop,
			)
		)
			return empty();
		await workshopKit().interest(String(subscriberId), signal);
	} catch {
		// No provider response, email or subscriber id in logs. No client retries.
		console.error('commerce.kit-interest.failed');
	}
	return empty();
};

function empty() {
	return new Response(null, {
		status: 204,
		headers: { 'Cache-Control': 'no-store' },
	});
}
