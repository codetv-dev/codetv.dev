import type { APIRoute } from 'astro';

import { getCheckoutStatus } from '../../../coursebuilder/checkout-status';

export const prerender = false;

/** Polled by the Purchase Processing screen at /thanks/purchase. */
export const GET: APIRoute = async ({ url }) => {
	const sessionId = url.searchParams.get('session_id') ?? '';
	const attempt = url.searchParams.get('attempt');
	const status = await getCheckoutStatus(sessionId);

	if (attempt === 'gave-up' && status.status !== 'ready') {
		// The buyer is looking at the "payment succeeded, setup delayed" message.
		console.error('purchase-processing.gave-up', {
			sessionId,
			status: status.status,
		});
	} else if (status.status !== 'ready') {
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
