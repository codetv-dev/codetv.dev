import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getEnrollmentWindow, pickCurrentTicket } from './enrollment.ts';

const opens = '2026-10-10T07:00:00.000Z';
const dayOne = '2026-11-02T08:00:00.000Z';

describe('getEnrollmentWindow', () => {
	it('is open between openEnrollment and closeEnrollment', () => {
		const window = getEnrollmentWindow({
			now: new Date('2026-10-20T00:00:00.000Z'),
			productActive: true,
			openEnrollment: opens,
			closeEnrollment: dayOne,
		});

		assert.equal(window.state, 'open');
		assert.equal(window.closesAt?.toISOString(), dayOne);
	});

	it('is not yet open before openEnrollment', () => {
		const window = getEnrollmentWindow({
			now: new Date('2026-10-09T00:00:00.000Z'),
			productActive: true,
			openEnrollment: opens,
			closeEnrollment: dayOne,
		});

		assert.equal(window.state, 'not-yet-open');
		assert.equal(window.reason, 'before-open');
	});

	it('closes exactly at closeEnrollment (cohort day one)', () => {
		const window = getEnrollmentWindow({
			now: new Date(dayOne),
			productActive: true,
			openEnrollment: opens,
			closeEnrollment: dayOne,
		});

		assert.equal(window.state, 'closed');
		assert.equal(window.reason, 'after-close');
	});

	it('falls back to the cohort start when the product has no closeEnrollment', () => {
		const before = getEnrollmentWindow({
			now: new Date('2026-11-01T00:00:00.000Z'),
			productActive: true,
			cohortStartsAt: dayOne,
		});
		const after = getEnrollmentWindow({
			now: new Date('2026-11-03T00:00:00.000Z'),
			productActive: true,
			cohortStartsAt: dayOne,
		});

		assert.equal(before.state, 'open');
		assert.equal(after.state, 'closed');
		assert.equal(after.closesAt?.toISOString(), dayOne);
	});

	it('prefers the product closeEnrollment over the cohort start', () => {
		const window = getEnrollmentWindow({
			now: new Date('2026-10-30T00:00:00.000Z'),
			productActive: true,
			closeEnrollment: '2026-10-29T00:00:00.000Z',
			cohortStartsAt: dayOne,
		});

		assert.equal(window.state, 'closed');
	});

	it('is closed when the product is inactive, even inside the window', () => {
		const window = getEnrollmentWindow({
			now: new Date('2026-10-20T00:00:00.000Z'),
			productActive: false,
			openEnrollment: opens,
			closeEnrollment: dayOne,
		});

		assert.equal(window.state, 'closed');
		assert.equal(window.reason, 'product-inactive');
	});

	it('is open with no window at all', () => {
		const window = getEnrollmentWindow({ productActive: true });

		assert.equal(window.state, 'open');
		assert.equal(window.opensAt, null);
		assert.equal(window.closesAt, null);
	});

	it('treats an unparseable closeEnrollment as missing and uses the cohort start', () => {
		const window = getEnrollmentWindow({
			now: new Date('2026-11-03T00:00:00.000Z'),
			productActive: true,
			closeEnrollment: 'garbage',
			cohortStartsAt: dayOne,
		});

		assert.equal(window.state, 'closed');
	});

	it('ignores unparseable dates instead of closing sales', () => {
		const window = getEnrollmentWindow({
			now: new Date('2026-10-20T00:00:00.000Z'),
			productActive: true,
			openEnrollment: 'not a date',
			closeEnrollment: dayOne,
		});

		assert.equal(window.state, 'open');
		assert.equal(window.opensAt, null);
	});
});

describe('pickCurrentTicket', () => {
	const now = new Date('2026-10-20T00:00:00.000Z');
	const candidate = (
		ticket: string,
		cohortStartsAt: string,
		openEnrollment?: string,
	) => ({
		ticket,
		cohortStartsAt: new Date(cohortStartsAt),
		enrollment: getEnrollmentWindow({
			now,
			productActive: true,
			openEnrollment,
			cohortStartsAt,
		}),
	});

	it('returns null with no candidates', () => {
		assert.equal(pickCurrentTicket([]), null);
	});

	it('prefers an open ticket over upcoming and closed ones', () => {
		const picked = pickCurrentTicket([
			candidate('past', '2026-09-01T00:00:00.000Z'),
			candidate(
				'upcoming',
				'2027-01-10T00:00:00.000Z',
				'2026-12-01T00:00:00.000Z',
			),
			candidate('open', '2026-11-02T00:00:00.000Z'),
		]);

		assert.equal(picked?.ticket, 'open');
	});

	it('picks the soonest open cohort', () => {
		const picked = pickCurrentTicket([
			candidate('later', '2026-12-02T00:00:00.000Z'),
			candidate('sooner', '2026-11-02T00:00:00.000Z'),
		]);

		assert.equal(picked?.ticket, 'sooner');
	});

	it('shows the most recent cohort when every ticket is closed', () => {
		const picked = pickCurrentTicket([
			candidate('older', '2026-06-01T00:00:00.000Z'),
			candidate('recent', '2026-09-01T00:00:00.000Z'),
		]);

		assert.equal(picked?.ticket, 'recent');
	});
});
