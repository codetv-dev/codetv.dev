/**
 * Polling schedule for the Purchase Processing screen.
 *
 * CONTEXT.md: keep the buyer in an optimistic state for about 60 seconds,
 * keep polling up to about 2 minutes, then show the support-oriented
 * "payment succeeded, setup delayed" fallback.
 *
 * Keep this module dependency-free: it runs in a React island and `node --test`.
 */

export const OPTIMISTIC_WINDOW_MS = 60_000;
export const GIVE_UP_AFTER_MS = 120_000;

export type CheckoutStatus =
	| {
			status: 'ready';
			purchaseId: string;
			productName: string | null;
			purchaseStatus: string;
	  }
	| { status: 'processing'; paymentStatus: string | null }
	| { status: 'not-paid'; paymentStatus: string | null }
	| { status: 'error'; message: string };

export type PollPhase = 'processing' | 'slow' | 'failed';

export type PollStep =
	| { phase: 'processing' | 'slow'; delayMs: number }
	| { phase: 'failed'; delayMs: null };

/**
 * Decide what the screen shows and when to poll next.
 *
 * @param elapsedMs - Time since the screen started polling.
 * @param attempt - Number of completed polls (0-based).
 */
export function getPollStep(elapsedMs: number, attempt: number): PollStep {
	if (elapsedMs >= GIVE_UP_AFTER_MS) {
		return { phase: 'failed', delayMs: null };
	}

	const delayMs = Math.min(1000 + attempt * 250, 3000);

	return {
		phase: elapsedMs >= OPTIMISTIC_WINDOW_MS ? 'slow' : 'processing',
		delayMs,
	};
}

/** True when the screen should stop polling and show the verified state. */
export function isVerified(status: CheckoutStatus | null) {
	return status?.status === 'ready';
}
