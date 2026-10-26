import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	missingCheckout,
	reconcilePaidCheckouts,
	postReconcileAlert,
	type ReconcileSession,
	type ReconcileCharge,
} from './checkout-reconcile.ts';

const nowSeconds = 2_000_000;
const session: ReconcileSession = {
	id: 'cs_test_fixture',
	mode: 'payment',
	status: 'complete',
	payment_status: 'paid',
	metadata: { productId: 'workshop-ticket' },
};
const charge: ReconcileCharge = {
	id: 'ch_fixture',
	created: nowSeconds - 600,
	paid: true,
	refunded: false,
	amount_refunded: 0,
};
const absent = { bySession: false, byCharge: false };

describe('paid checkout reconciliation fixtures', () => {
	it('reports a CourseBuilder checkout at the 10 minute payment-age boundary', () => {
		assert.deepEqual(missingCheckout(session, charge, absent, nowSeconds), {
			sessionId: session.id,
			productId: 'workshop-ticket',
			ageSeconds: 600,
		});
	});
	it('filters unrelated, unpaid, incomplete and subscription sessions', () => {
		for (const fixture of [
			{ ...session, metadata: null },
			{ ...session, metadata: {} },
			{ ...session, metadata: { productId: ' ' } },
			{ ...session, mode: 'subscription' },
			{ ...session, status: 'open' },
			{ ...session, payment_status: 'unpaid' },
		])
			assert.equal(missingCheckout(fixture, charge, absent, nowSeconds), null);
	});
	it('requires payment-time evidence and skips young, future, old and refunded charges', () => {
		for (const fixture of [
			null,
			{ ...charge, created: nowSeconds - 599 },
			{ ...charge, created: nowSeconds + 1 },
			{ ...charge, created: nowSeconds - 48 * 3600 - 1 },
			{ ...charge, refunded: true },
			{ ...charge, amount_refunded: 1 },
			{ ...charge, paid: false },
		])
			assert.equal(missingCheckout(session, fixture, absent, nowSeconds), null);
		assert.ok(
			missingCheckout(
				session,
				{ ...charge, created: nowSeconds - 48 * 3600 },
				absent,
				nowSeconds,
			),
		);
	});
	it('accepts a purchase linked by either session or charge', () => {
		assert.equal(
			missingCheckout(
				session,
				charge,
				{ ...absent, bySession: true },
				nowSeconds,
			),
			null,
		);
		assert.equal(
			missingCheckout(
				session,
				charge,
				{ ...absent, byCharge: true },
				nowSeconds,
			),
			null,
		);
	});
	it('diffs a paginated async stream without alerting on matched or unrelated sessions', async () => {
		const alerts: unknown[] = [];
		const count = await reconcilePaidCheckouts({
			sessions: (async function* () {
				yield { ...session, id: 'matched' };
				yield { ...session, metadata: null };
				yield session;
			})(),
			getCharge: async () => charge,
			hasPurchase: async (kind, id) => kind === 'session' && id === 'matched',
			alert: (missing) => {
				alerts.push(missing);
			},
			nowSeconds,
		});
		assert.equal(count, 1);
		assert.equal(alerts.length, 1);
	});
	it('does not turn database failures into missing-purchase alerts', async () => {
		const alerts: unknown[] = [];
		await assert.rejects(
			reconcilePaidCheckouts({
				sessions: (async function* () {
					yield session;
				})(),
				getCharge: async () => charge,
				hasPurchase: async () => {
					throw new Error('DB unavailable');
				},
				alert: (missing) => {
					alerts.push(missing);
				},
				nowSeconds,
			}),
			/DB unavailable/,
		);
		assert.deepEqual(alerts, []);
	});
	it('posts the Slack/Discord JSON payload with a five-second timeout', async () => {
		const timeout = AbortSignal.timeout;
		let timeoutMs: number | undefined;
		try {
			AbortSignal.timeout = (ms) => {
				timeoutMs = ms;
				return timeout(ms);
			};
			await postReconcileAlert(
				{
					sessionId: session.id,
					productId: 'workshop-ticket',
					ageSeconds: 659,
				},
				{
					url: 'https://example.invalid/synthetic-webhook',
					fetch: async (url, init) => {
						assert.equal(url, 'https://example.invalid/synthetic-webhook');
						assert.equal(init?.method, 'POST');
						assert.deepEqual(init?.headers, {
							'Content-Type': 'application/json',
						});
						const msg =
							'CodeTV paid checkout with no ticket: session cs_test_fixture, product workshop-ticket, paid 10 min ago';
						const body = JSON.parse(String(init?.body));
						assert.equal(body.text, msg);
						assert.equal(body.content, msg);
						assert.equal(body.message, msg);
						assert.ok(init?.signal instanceof AbortSignal);
						return new Response(null, { status: 204 });
					},
				},
			);
			assert.equal(timeoutMs, 5000);
		} finally {
			AbortSignal.timeout = timeout;
		}
	});
	it('sends the ShitRat bearer key only when one is configured', async () => {
		let headers: HeadersInit | undefined;
		await postReconcileAlert(
			{ sessionId: session.id, productId: 'workshop-ticket', ageSeconds: 659 },
			{
				url: 'https://example.invalid/synthetic-webhook',
				key: 'synthetic-key',
				fetch: async (_url, init) => {
					headers = init?.headers;
					return new Response(null, { status: 204 });
				},
			},
		);
		assert.deepEqual(headers, {
			'Content-Type': 'application/json',
			Authorization: 'Bearer synthetic-key',
		});
	});
	it('webhook transport, timeout and HTTP failures do not break the sweep or leak the URL', async () => {
		for (const failure of ['network', 'timeout', 'http']) {
			const logs: unknown[] = [];
			let posts = 0;
			const count = await reconcilePaidCheckouts({
				sessions: (async function* () {
					yield session;
					yield { ...session, id: 'cs_test_second' };
				})(),
				getCharge: async () => charge,
				hasPurchase: async () => false,
				nowSeconds,
				alert: (missing) =>
					postReconcileAlert(missing, {
						url: 'https://example.invalid/synthetic-webhook-secret',
						fetch: async () => {
							posts++;
							if (failure === 'http')
								return new Response(null, { status: 503 });
							if (failure === 'timeout')
								throw new DOMException(
									'synthetic-webhook-secret',
									'TimeoutError',
								);
							throw new Error('synthetic-webhook-secret');
						},
						log: (event, fields) => {
							logs.push({ event, ...fields });
						},
					}),
			});
			assert.equal(count, 2);
			assert.equal(posts, 2);
			assert.equal(logs.length, 2);
			assert.match(JSON.stringify(logs), /commerce.reconcile.alert-failed/);
			assert.doesNotMatch(
				JSON.stringify(logs),
				/synthetic-webhook-secret|example.invalid/,
			);
		}
	});
	it('does not post when the optional webhook URL is unset', async () => {
		await postReconcileAlert(
			{ sessionId: session.id, productId: 'workshop-ticket', ageSeconds: 600 },
			{
				fetch: async () => {
					assert.fail('unset webhook must not POST');
				},
			},
		);
	});
});
