import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { missingCheckout, reconcilePaidCheckouts, type ReconcileSession, type ReconcileCharge } from './checkout-reconcile.ts';

const nowSeconds = 2_000_000;
const session: ReconcileSession = { id: 'cs_test_fixture', mode: 'payment', status: 'complete', payment_status: 'paid', metadata: { productId: 'workshop-ticket' } };
const charge: ReconcileCharge = { id: 'ch_fixture', created: nowSeconds - 600, paid: true, refunded: false, amount_refunded: 0 };
const absent = { bySession: false, byCharge: false };

describe('paid checkout reconciliation fixtures', () => {
	it('reports a CourseBuilder checkout at the 10 minute payment-age boundary', () => {
		assert.deepEqual(missingCheckout(session, charge, absent, nowSeconds), { sessionId: session.id, productId: 'workshop-ticket', ageSeconds: 600 });
	});
	it('filters unrelated, unpaid, incomplete and subscription sessions', () => {
		for (const fixture of [
			{ ...session, metadata: null }, { ...session, metadata: {} },
			{ ...session, metadata: { productId: ' ' } },
			{ ...session, mode: 'subscription' }, { ...session, status: 'open' },
			{ ...session, payment_status: 'unpaid' },
		]) assert.equal(missingCheckout(fixture, charge, absent, nowSeconds), null);
	});
	it('requires payment-time evidence and skips young, future, old and refunded charges', () => {
		for (const fixture of [null,
			{ ...charge, created: nowSeconds - 599 }, { ...charge, created: nowSeconds + 1 },
			{ ...charge, created: nowSeconds - 48 * 3600 - 1 },
			{ ...charge, refunded: true }, { ...charge, amount_refunded: 1 },
			{ ...charge, paid: false },
		]) assert.equal(missingCheckout(session, fixture, absent, nowSeconds), null);
		assert.ok(missingCheckout(session, { ...charge, created: nowSeconds - 48 * 3600 }, absent, nowSeconds));
	});
	it('accepts a purchase linked by either session or charge', () => {
		assert.equal(missingCheckout(session, charge, { ...absent, bySession: true }, nowSeconds), null);
		assert.equal(missingCheckout(session, charge, { ...absent, byCharge: true }, nowSeconds), null);
	});
	it('diffs a paginated async stream without alerting on matched or unrelated sessions', async () => {
		const alerts: unknown[] = [];
		const count = await reconcilePaidCheckouts({
			sessions: (async function* () { yield { ...session, id: 'matched' }; yield { ...session, metadata: null }; yield session; })(),
			getCharge: async () => charge,
			hasPurchase: async (kind, id) => kind === 'session' && id === 'matched',
			alert: (missing) => alerts.push(missing), nowSeconds,
		});
		assert.equal(count, 1); assert.equal(alerts.length, 1);
	});
	it('does not turn database failures into missing-purchase alerts', async () => {
		const alerts: unknown[] = [];
		await assert.rejects(reconcilePaidCheckouts({
			sessions: (async function* () { yield session; })(), getCharge: async () => charge,
			hasPurchase: async () => { throw new Error('DB unavailable'); },
			alert: (missing) => alerts.push(missing), nowSeconds,
		}), /DB unavailable/);
		assert.deepEqual(alerts, []);
	});
});
