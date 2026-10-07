/**
 * Enrollment window for a Workshop Ticket.
 *
 * CourseBuilder stores the window on the product as `fields.openEnrollment`
 * and `fields.closeEnrollment` (ISO strings). `createCohort` sets
 * `closeEnrollment` to the Cohort start date, so ticket sales stop on day one.
 * When a product has no `closeEnrollment`, the Cohort's `startsAt` is used.
 *
 * Keep this module dependency-free: it runs in Astro pages, React islands and
 * `node --test`.
 */

export type EnrollmentState = 'open' | 'not-yet-open' | 'closed';

export type EnrollmentWindowInput = {
	now?: Date;
	/** Product is active (status 1) and its `fields.state` is `published`. */
	productActive: boolean;
	openEnrollment?: string | Date | null;
	closeEnrollment?: string | Date | null;
	cohortStartsAt?: string | Date | null;
};

export type EnrollmentWindow = {
	state: EnrollmentState;
	opensAt: Date | null;
	closesAt: Date | null;
	reason: 'product-inactive' | 'before-open' | 'after-close' | 'within-window';
};

function toDate(value: string | Date | null | undefined): Date | null {
	if (!value) return null;
	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

export function getEnrollmentWindow({
	now = new Date(),
	productActive,
	openEnrollment,
	closeEnrollment,
	cohortStartsAt,
}: EnrollmentWindowInput): EnrollmentWindow {
	const opensAt = toDate(openEnrollment);
	const closesAt = toDate(closeEnrollment) ?? toDate(cohortStartsAt);

	if (!productActive) {
		return { state: 'closed', opensAt, closesAt, reason: 'product-inactive' };
	}

	if (opensAt && now.getTime() < opensAt.getTime()) {
		return { state: 'not-yet-open', opensAt, closesAt, reason: 'before-open' };
	}

	if (closesAt && now.getTime() >= closesAt.getTime()) {
		return { state: 'closed', opensAt, closesAt, reason: 'after-close' };
	}

	return { state: 'open', opensAt, closesAt, reason: 'within-window' };
}

export type TicketCandidate<T> = {
	ticket: T;
	enrollment: EnrollmentWindow;
	cohortStartsAt?: Date | null;
};

const stateRank: Record<EnrollmentState, number> = {
	open: 0,
	'not-yet-open': 1,
	closed: 2,
};

/**
 * Pick the Workshop Ticket a Workshop page should sell.
 *
 * Open beats not-yet-open beats closed. Among open or upcoming tickets, the
 * soonest Cohort wins. Among closed tickets, the most recent Cohort wins so
 * the page shows the last run.
 */
export function pickCurrentTicket<T>(
	candidates: TicketCandidate<T>[],
): TicketCandidate<T> | null {
	const time = (candidate: TicketCandidate<T>) =>
		candidate.cohortStartsAt?.getTime() ??
		candidate.enrollment.closesAt?.getTime() ??
		Number.POSITIVE_INFINITY;

	const sorted = [...candidates].sort((a, b) => {
		const byState =
			stateRank[a.enrollment.state] - stateRank[b.enrollment.state];
		if (byState !== 0) return byState;

		if (a.enrollment.state === 'closed') {
			// Infinity (no date) sorts last for closed tickets too.
			const aTime = Number.isFinite(time(a)) ? time(a) : -Infinity;
			const bTime = Number.isFinite(time(b)) ? time(b) : -Infinity;
			return bTime - aTime;
		}

		return time(a) - time(b);
	});

	return sorted[0] ?? null;
}
