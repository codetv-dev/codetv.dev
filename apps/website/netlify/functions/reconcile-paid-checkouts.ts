import type { Config } from '@netlify/functions';
import Stripe from 'stripe';
import { Client } from '@planetscale/database';
import {
	reconcilePaidCheckouts,
	postReconcileAlert,
	RECONCILE_WINDOW_SECONDS,
	type ReconcileCharge,
	type ReconcileSession,
} from '../../src/coursebuilder/checkout-reconcile';

export const config: Config = { schedule: '0 * * * *' };

export default async function () {
	const token = process.env.COURSEBUILDER_STRIPE_SECRET_TOKEN;
	if (!token)
		throw new Error(
			'COURSEBUILDER_STRIPE_SECRET_TOKEN is required for reconciliation',
		);
	const stripe = new Stripe(token);
	const nowSeconds = Math.floor(Date.now() / 1000);
	const charges = new Map<string, ReconcileCharge>();
	const seen = new Set<string>();

	async function* paidSessions(): AsyncGenerator<ReconcileSession> {
		// Stripe filters sessions by creation, not completion. Enumerate recent charges
		// first so an old session paid within the last 48h is not missed.
		for await (const charge of stripe.charges.list({
			created: { gte: nowSeconds - RECONCILE_WINDOW_SECONDS, lte: nowSeconds },
			limit: 100,
		})) {
			if (
				!charge.paid ||
				charge.refunded ||
				charge.amount_refunded > 0 ||
				!charge.payment_intent
			)
				continue;
			const paymentIntentId =
				typeof charge.payment_intent === 'string'
					? charge.payment_intent
					: charge.payment_intent.id;
			for await (const session of stripe.checkout.sessions.list({
				payment_intent: paymentIntentId,
				status: 'complete',
				limit: 100,
			})) {
				if (seen.has(session.id)) continue;
				seen.add(session.id);
				charges.set(session.id, charge);
				yield session;
			}
		}
	}

	try {
		if (!process.env.DATABASE_URL)
			throw new Error('DATABASE_URL is required for reconciliation');
		const connection = new Client({
			url: process.env.DATABASE_URL,
		}).connection();
		const missingCount = await reconcilePaidCheckouts({
			sessions: paidSessions(),
			getCharge: async (session) => charges.get(session.id) ?? null,
			hasPurchase: async (kind, id) => {
				// Match src/db/mysql-table.ts and core's merchant identity joins.
				// Read raw IDs to avoid requiring the ESM-only commerce adapter in CJS.
				const query =
					kind === 'session'
						? 'SELECT p.id FROM ctv_Purchase p INNER JOIN ctv_MerchantSession m ON p.merchantSessionId = m.id WHERE m.identifier = ? LIMIT 1'
						: 'SELECT p.id FROM ctv_Purchase p INNER JOIN ctv_MerchantCharge m ON p.merchantChargeId = m.id WHERE m.identifier = ? LIMIT 1';
				const result = await connection.execute(query, [id]);
				return result.rows.length > 0;
			},
			alert: async (missing) => {
				console.error(
					JSON.stringify({ event: 'commerce.reconcile.missing', ...missing }),
				);
				await postReconcileAlert(missing, {
					url: process.env.RECONCILE_ALERT_WEBHOOK_URL,
				});
			},
			nowSeconds,
		});
		console.info(
			JSON.stringify({ event: 'commerce.reconcile.complete', missingCount }),
		);
		return new Response(null, { status: 204 });
	} catch (error) {
		console.error(
			JSON.stringify({
				event: 'commerce.reconcile.failed',
				message: error instanceof Error ? error.message : String(error),
			}),
		);
		throw error;
	}
}
