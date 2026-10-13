import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { startPurchaseWait, isCheckoutStatus } from './purchase-wait.ts';
import type { CheckoutStatus, PollPhase } from './purchase-polling.ts';

function fakeClock() {
	let now = 0;
	let nextId = 0;
	const jobs = new Map<number, { at: number; callback: () => void }>();
	return {
		setTimeout(callback: () => void, delay: number) {
			const id = ++nextId;
			jobs.set(id, { at: now + delay, callback });
			return id;
		},
		clearTimeout(id: unknown) {
			jobs.delete(id as number);
		},
		async advance(ms: number) {
			const target = now + ms;
			while (true) {
				const next = [...jobs.entries()]
					.filter(([, job]) => job.at <= target)
					.sort((a, b) => a[1].at - b[1].at)[0];
				if (!next) break;
				now = next[1].at;
				jobs.delete(next[0]);
				next[1].callback();
				await Promise.resolve();
				await Promise.resolve();
			}
			now = target;
			await Promise.resolve();
			await Promise.resolve();
		},
		pending: () => jobs.size,
	};
}
const processing: CheckoutStatus = {
	status: 'processing',
	paymentStatus: 'paid',
};
const ready: CheckoutStatus = {
	status: 'ready',
	purchaseId: 'p_fixture',
	productName: 'Workshop',
	purchaseStatus: 'Valid',
};

describe('purchase wait lifecycle', () => {
	it('shows slow copy at 10s and support at 90s even when the first request never resolves', async () => {
		const clock = fakeClock();
		const phases: PollPhase[] = [];
		const statuses: CheckoutStatus[] = [];
		let signal: AbortSignal | undefined;
		let resolve: (status: CheckoutStatus) => void = () => {};
		startPurchaseWait({
			clock,
			check: (_attempt, requestSignal) => {
				signal = requestSignal;
				return new Promise<CheckoutStatus>((done) => {
					resolve = done;
				});
			},
			onPhase: (phase) => phases.push(phase),
			onStatus: (status) => statuses.push(status),
		});
		await clock.advance(9_999);
		assert.deepEqual(phases, ['processing']);
		await clock.advance(1);
		assert.deepEqual(phases, ['processing', 'slow']);
		await clock.advance(79_999);
		assert.equal(signal?.aborted, false);
		await clock.advance(1);
		assert.deepEqual(phases, ['processing', 'slow', 'failed']);
		assert.equal(signal?.aborted, true);
		assert.equal(clock.pending(), 0);
		resolve(ready);
		await clock.advance(0);
		assert.deepEqual(statuses, []);
	});
	it('retry starts a fresh 90s deadline and abort signal; the old request stays ignored', async () => {
		const clock = fakeClock();
		const signals: AbortSignal[] = [];
		const statuses: CheckoutStatus[] = [];
		const phases: PollPhase[] = [];
		const deps = {
			clock,
			check: async (_attempt: number, signal: AbortSignal) => {
				signals.push(signal);
				return processing;
			},
			onStatus: (s: CheckoutStatus) => statuses.push(s),
			onPhase: (p: PollPhase) => phases.push(p),
		};
		const stop = startPurchaseWait(deps);
		await clock.advance(90_000);
		assert.equal(phases.at(-1), 'failed');
		stop();
		const firstSignal = signals[0];
		const stopRetry = startPurchaseWait(deps);
		assert.equal(phases.at(-1), 'processing');
		await clock.advance(1000);
		assert.notEqual(signals.at(-1), firstSignal);
		assert.equal(signals.at(-1)?.aborted, false);
		await clock.advance(88_999);
		assert.equal(phases.at(-1), 'slow');
		await clock.advance(1);
		assert.equal(phases.at(-1), 'failed');
		stopRetry();
	});
	it('completion cancels all timers and stops polling', async () => {
		const clock = fakeClock();
		const statuses: CheckoutStatus[] = [];
		const phases: PollPhase[] = [];
		startPurchaseWait({
			clock,
			check: async () => ready,
			onStatus: (s) => statuses.push(s),
			onPhase: (p) => phases.push(p),
		});
		await clock.advance(1000);
		assert.deepEqual(statuses, [ready]);
		assert.equal(clock.pending(), 0);
		await clock.advance(100_000);
		assert.deepEqual(phases, ['processing']);
	});
	it('retries transport failures without calling them failed payments', async () => {
		const clock = fakeClock();
		const statuses: CheckoutStatus[] = [];
		let attempts = 0;
		startPurchaseWait({
			clock,
			check: async () => {
				if (++attempts === 1) throw new Error('offline');
				return ready;
			},
			onStatus: (s) => statuses.push(s),
			onPhase: () => {},
		});
		await clock.advance(3000);
		assert.deepEqual(statuses, [ready]);
	});
	it('unmount aborts and ignores late responses', async () => {
		const clock = fakeClock();
		const statuses: CheckoutStatus[] = [];
		let resolve: (s: CheckoutStatus) => void = () => {};
		let signal: AbortSignal | undefined;
		const stop = startPurchaseWait({
			clock,
			check: (_attempt, s) => {
				signal = s;
				return new Promise<CheckoutStatus>((done) => {
					resolve = done;
				});
			},
			onStatus: (s) => statuses.push(s),
			onPhase: () => {},
		});
		await clock.advance(1000);
		stop();
		assert.equal(signal?.aborted, true);
		resolve(ready);
		await clock.advance(100_000);
		assert.deepEqual(statuses, []);
		assert.equal(clock.pending(), 0);
	});
	it('explicit lookup errors go to support, not a payment failure', async () => {
		const clock = fakeClock();
		const phases: PollPhase[] = [];
		startPurchaseWait({
			clock,
			check: async () => ({ status: 'error', message: 'Unknown checkout' }),
			onStatus: () => {},
			onPhase: (p) => phases.push(p),
		});
		await clock.advance(1000);
		assert.deepEqual(phases, ['processing', 'failed']);
		assert.equal(clock.pending(), 0);
	});
	it('validates JSON before trusting ready or payment evidence', () => {
		assert.equal(isCheckoutStatus(ready), true);
		assert.equal(isCheckoutStatus(processing), true);
		for (const value of [
			null,
			'ready',
			{},
			{ status: 'ready' },
			{ status: 'processing', paymentStatus: 2 },
			{ status: 'unknown' },
		])
			assert.equal(isCheckoutStatus(value), false);
	});
});
