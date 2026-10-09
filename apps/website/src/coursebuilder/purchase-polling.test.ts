import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
	GIVE_UP_AFTER_MS,
	OPTIMISTIC_WINDOW_MS,
	getPollStep,
	isVerified,
} from './purchase-polling.ts';

describe('getPollStep', () => {
	it('starts optimistic and polls after one second', () => {
		assert.deepEqual(getPollStep(0, 0), { phase: 'processing', delayMs: 1000 });
	});

	it('backs off by 250ms per attempt, capped at 3 seconds', () => {
		assert.equal(getPollStep(5_000, 4).delayMs, 2000);
		assert.equal(getPollStep(20_000, 8).delayMs, 3000);
		assert.equal(getPollStep(50_000, 30).delayMs, 3000);
	});

	it('stays optimistic for the first minute', () => {
		assert.equal(getPollStep(OPTIMISTIC_WINDOW_MS - 1, 20).phase, 'processing');
	});

	it('escalates to "still setting up" after a minute but keeps polling', () => {
		const step = getPollStep(OPTIMISTIC_WINDOW_MS, 25);

		assert.equal(step.phase, 'slow');
		assert.equal(step.delayMs, 3000);
	});

	it('gives up after about two minutes and stops polling', () => {
		assert.deepEqual(getPollStep(GIVE_UP_AFTER_MS, 45), {
			phase: 'failed',
			delayMs: null,
		});
	});
});

describe('isVerified', () => {
	it('is true only for a ready purchase', () => {
		assert.equal(
			isVerified({
				status: 'ready',
				purchaseId: 'purch_1',
				productName: 'Workshop Ticket',
				purchaseStatus: 'Valid',
			}),
			true,
		);
		assert.equal(
			isVerified({ status: 'processing', paymentStatus: 'paid' }),
			false,
		);
		assert.equal(isVerified({ status: 'error', message: 'nope' }), false);
		assert.equal(isVerified(null), false);
	});
});
