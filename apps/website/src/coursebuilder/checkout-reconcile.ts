/** Alert-only rules. Payment age comes from the charge, never session creation. */
export const RECONCILE_WINDOW_SECONDS = 48 * 60 * 60;
export const RECONCILE_MIN_AGE_SECONDS = 10 * 60;

export type ReconcileSession = {
	id: string;
	mode: string | null;
	status: string | null;
	payment_status: string;
	metadata: Record<string, string> | null;
};
export type ReconcileCharge = {
	id: string;
	created: number;
	paid: boolean;
	refunded: boolean;
	amount_refunded: number;
};
export type MissingCheckout = { sessionId: string; productId: string; ageSeconds: number };

export function isCourseBuilderPaidSession(session: ReconcileSession): boolean {
	return session.mode === 'payment' && session.status === 'complete' &&
		session.payment_status === 'paid' && Boolean(session.metadata?.productId?.trim());
}

export function missingCheckout(
	session: ReconcileSession,
	charge: ReconcileCharge | null,
	purchases: { bySession: boolean; byCharge: boolean },
	nowSeconds: number,
): MissingCheckout | null {
	if (!isCourseBuilderPaidSession(session) || !charge?.paid ||
		charge.refunded || charge.amount_refunded > 0 ||
		purchases.bySession || purchases.byCharge) return null;
	const ageSeconds = nowSeconds - charge.created;
	if (ageSeconds < RECONCILE_MIN_AGE_SECONDS || ageSeconds > RECONCILE_WINDOW_SECONDS) return null;
	return { sessionId: session.id, productId: session.metadata!.productId, ageSeconds };
}

/** Provider/DB errors propagate. A failed lookup must never become a missing-purchase alert. */
export async function reconcilePaidCheckouts(deps: {
	sessions: AsyncIterable<ReconcileSession>;
	getCharge: (session: ReconcileSession) => Promise<ReconcileCharge | null>;
	hasPurchase: (kind: 'session' | 'charge', id: string) => Promise<boolean>;
	alert: (missing: MissingCheckout) => void;
	nowSeconds: number;
}): Promise<number> {
	let missingCount = 0;
	for await (const session of deps.sessions) {
		if (!isCourseBuilderPaidSession(session)) continue;
		const charge = await deps.getCharge(session);
		// Filter before DB calls; unexpanded/missing charges are not age evidence.
		if (!missingCheckout(session, charge, { bySession: false, byCharge: false }, deps.nowSeconds)) continue;
		const [bySession, byCharge] = await Promise.all([
			deps.hasPurchase('session', session.id),
			deps.hasPurchase('charge', charge!.id),
		]);
		const missing = missingCheckout(session, charge, { bySession, byCharge }, deps.nowSeconds);
		if (missing) { deps.alert(missing); missingCount++; }
	}
	return missingCount;
}
