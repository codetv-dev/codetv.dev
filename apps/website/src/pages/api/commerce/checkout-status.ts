import type { APIRoute } from 'astro';

import { getCheckoutStatus } from '../../../coursebuilder/checkout-status';

export const prerender = false;

/** Polled by the Purchase Processing screen at /thanks/purchase. */
export const GET: APIRoute = async ({ url }) => {
	const sessionId = url.searchParams.get('session_id') ?? '';
	const attempt = url.searchParams.get('attempt');
	// UI observations must not wait for another possibly stalled provider lookup.
	if (attempt === 'slow' || attempt === 'gave-up') {
		if (attempt === 'slow') {
			console.info('purchase-processing.slow', { sessionId });
		} else {
			console.error('purchase-processing.gave-up', {
				sessionId,
				status: 'unconfirmed',
			});
			console.error('purchase-processing.support-shown', { sessionId });
		}
		return new Response(null, {
			status: 204,
			headers: { 'Cache-Control': 'no-store, max-age=0' },
		});
	}
	const status = await getCheckoutStatus(sessionId);

	if (status.status !== 'ready') {
		console.info('purchase-processing.poll', {
			sessionId,
			attempt,
			status: status.status,
			...(status.status === 'processing' || status.status === 'not-paid'
				? { paymentStatus: status.paymentStatus }
				: {}),
		});
	}

	return Response.json(status, {
		status: status.status === 'error' ? 400 : 200,
		headers: { 'Cache-Control': 'no-store, max-age=0' },
	});
};
