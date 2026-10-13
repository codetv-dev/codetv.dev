import {
	GIVE_UP_AFTER_MS,
	OPTIMISTIC_WINDOW_MS,
	getPollStep,
	type CheckoutStatus,
	type PollPhase,
} from './purchase-polling.ts';

type Clock = {
	setTimeout: (callback: () => void, delayMs: number) => unknown;
	clearTimeout: (id: unknown) => void;
};
const clock: Clock = {
	setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
	clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
};

/** Runtime boundary: invalid JSON is a retryable transport problem, never payment evidence. */
export function isCheckoutStatus(value: unknown): value is CheckoutStatus {
	if (!value || typeof value !== 'object' || !('status' in value)) return false;
	if (value.status === 'ready')
		return (
			'purchaseId' in value &&
			typeof value.purchaseId === 'string' &&
			'purchaseStatus' in value &&
			typeof value.purchaseStatus === 'string' &&
			'productName' in value &&
			(value.productName === null || typeof value.productName === 'string')
		);
	if (value.status === 'processing' || value.status === 'not-paid')
		return (
			'paymentStatus' in value &&
			(value.paymentStatus === null || typeof value.paymentStatus === 'string')
		);
	return (
		value.status === 'error' &&
		'message' in value &&
		typeof value.message === 'string'
	);
}

/**
 * Dependency-free interpreter for the AI Hero waiting machine:
 * checking.waiting <-> checking.polling -> ready | failed; cleanup -> stopped.
 * Slow/deadline timers belong to checking, not an individual fetch.
 * Calling this again (RETRY) resets attempts, timers and the abort signal.
 */
export function startPurchaseWait(deps: {
	check: (
		attempt: number,
		signal: AbortSignal,
	) => Promise<CheckoutStatus | null>;
	onStatus: (status: CheckoutStatus) => void;
	onPhase: (phase: PollPhase) => void;
	clock?: Clock;
}): () => void {
	const timer = deps.clock ?? clock;
	const request = new AbortController();
	let state:
		'checking.waiting' | 'checking.polling' | 'ready' | 'failed' | 'stopped' =
		'checking.waiting';
	const timers = new Set<unknown>();
	const checking = () =>
		state === 'checking.waiting' || state === 'checking.polling';
	const after = (delay: number, callback: () => void) => {
		const id = timer.setTimeout(() => {
			timers.delete(id);
			callback();
		}, delay);
		timers.add(id);
	};
	const exit = (next: 'ready' | 'failed' | 'stopped') => {
		state = next;
		for (const id of timers) timer.clearTimeout(id);
		timers.clear();
		request.abort();
	};
	const poll = async (attempt: number) => {
		if (!checking()) return;
		state = 'checking.polling';
		try {
			const next = await deps.check(attempt, request.signal);
			if (!checking()) return; // Late results from timed-out, retried or unmounted checks are ignored.
			if (next) {
				deps.onStatus(next);
				if (next.status !== 'processing') {
					exit(next.status === 'ready' ? 'ready' : 'failed');
					if (next.status !== 'ready') deps.onPhase('failed');
					return;
				}
			}
		} catch {
			if (!checking()) return;
		}
		state = 'checking.waiting';
		after(getPollStep(0, attempt).delayMs!, () => void poll(attempt + 1));
	};
	deps.onPhase('processing');
	after(OPTIMISTIC_WINDOW_MS, () => {
		if (checking()) deps.onPhase('slow');
	});
	after(GIVE_UP_AFTER_MS, () => {
		if (!checking()) return;
		exit('failed');
		deps.onPhase('failed');
	});
	after(1000, () => void poll(1));
	return () => exit('stopped');
}
