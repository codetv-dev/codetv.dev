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
export type MissingCheckout = {
	sessionId: string;
	productId: string;
	ageSeconds: number;
};

export function isCourseBuilderPaidSession(session: ReconcileSession): boolean {
	return (
		session.mode === 'payment' &&
		session.status === 'complete' &&
		session.payment_status === 'paid' &&
		Boolean(session.metadata?.productId?.trim())
	);
}

export function missingCheckout(
	session: ReconcileSession,
	charge: ReconcileCharge | null,
	purchases: { bySession: boolean; byCharge: boolean },
	nowSeconds: number,
): MissingCheckout | null {
	if (
		!isCourseBuilderPaidSession(session) ||
		!charge?.paid ||
		charge.refunded ||
		charge.amount_refunded > 0 ||
		purchases.bySession ||
		purchases.byCharge
	)
		return null;
	const ageSeconds = nowSeconds - charge.created;
	if (
		ageSeconds < RECONCILE_MIN_AGE_SECONDS ||
		ageSeconds > RECONCILE_WINDOW_SECONDS
	)
		return null;
	return {
		sessionId: session.id,
		productId: session.metadata!.productId,
		ageSeconds,
	};
}

/**
 * Best-effort alert to a Slack/Discord webhook, or the ShitRat chat webhook when
 * `key` is set (sent as a bearer token). Never log the URL, key or provider error text.
 */
export async function postReconcileAlert(
	missing: MissingCheckout,
	options: {
		url?: string;
		key?: string;
		fetch?: typeof fetch;
		log?: (event: string, fields: Record<string, unknown>) => void;
	},
): Promise<void> {
	if (!options.url) return;
	const log =
		options.log ??
		((event, fields) => console.error(JSON.stringify({ event, ...fields })));
	const msg = `CodeTV paid checkout with no ticket: session ${missing.sessionId}, product ${missing.productId}, paid ${Math.floor(missing.ageSeconds / 60)} min ago`;
	try {
		const response = await (options.fetch ?? fetch)(options.url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				...(options.key ? { Authorization: `Bearer ${options.key}` } : {}),
			},
			// text/content for Slack and Discord; message/event/source for ShitRat.
			body: JSON.stringify({
				text: msg,
				content: msg,
				message: msg,
				event: 'needs_joel',
				source: 'codetv-reconcile',
				links: [],
				ts: new Date().toISOString(),
			}),
			signal: AbortSignal.timeout(5000),
		});
		if (!response.ok)
			log('commerce.reconcile.alert-failed', {
				sessionId: missing.sessionId,
				status: response.status,
			});
	} catch (error) {
		log('commerce.reconcile.alert-failed', {
			sessionId: missing.sessionId,
			reason: error instanceof Error ? error.name : 'UnknownError',
		});
	}
}

/** Provider/DB errors propagate. A failed lookup must never become a missing-purchase alert. */
export async function reconcilePaidCheckouts(deps: {
	sessions: AsyncIterable<ReconcileSession>;
	getCharge: (session: ReconcileSession) => Promise<ReconcileCharge | null>;
	hasPurchase: (kind: 'session' | 'charge', id: string) => Promise<boolean>;
	alert: (missing: MissingCheckout) => void | Promise<void>;
	nowSeconds: number;
}): Promise<number> {
	let missingCount = 0;
	for await (const session of deps.sessions) {
		if (!isCourseBuilderPaidSession(session)) continue;
		const charge = await deps.getCharge(session);
		// Filter before DB calls; unexpanded/missing charges are not age evidence.
		if (
			!missingCheckout(
				session,
				charge,
				{ bySession: false, byCharge: false },
				deps.nowSeconds,
			)
		)
			continue;
		const [bySession, byCharge] = await Promise.all([
			deps.hasPurchase('session', session.id),
			deps.hasPurchase('charge', charge!.id),
		]);
		const missing = missingCheckout(
			session,
			charge,
			{ bySession, byCharge },
			deps.nowSeconds,
		);
		if (missing) {
			await deps.alert(missing);
			missingCount++;
		}
	}
	return missingCount;
}
