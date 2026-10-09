import { useEffect, useState } from 'react';

import {
	getPollStep,
	type CheckoutStatus,
	type PollPhase,
} from '../../coursebuilder/purchase-polling';

type Status = CheckoutStatus & { workshopPath?: string | null };

type PurchaseProcessingProps = {
	sessionId: string;
	initialStatus: Status;
	supportEmail: string;
};

/**
 * Purchase Processing screen, mirroring the AI Hero / Code with Antonio
 * thanks-page pattern: reassure the buyer right away, poll until the purchase
 * is verified in the database, then show the welcome state. After about two
 * minutes, show the shared "payment succeeded, setup delayed" message.
 *
 * TODO: invoice, Ticket Transfer and team distribution actions unlock here
 * once verified. Port ai-hero/apps/ai-hero/src/app/(commerce)/thanks/purchase/page.tsx.
 */
export function PurchaseProcessing({
	sessionId,
	initialStatus,
	supportEmail,
}: PurchaseProcessingProps) {
	const [status, setStatus] = useState<Status>(initialStatus);
	const [phase, setPhase] = useState<PollPhase>('processing');

	useEffect(() => {
		if (status.status !== 'processing') return;

		let cancelled = false;
		let timeoutId: ReturnType<typeof setTimeout> | undefined;
		const startedAt = Date.now();

		const schedule = (attempt: number) => {
			const step = getPollStep(Date.now() - startedAt, attempt);
			setPhase(step.phase);

			if (step.phase === 'failed') {
				// One last request so the server logs that this buyer saw the fallback.
				void fetch(
					`/api/commerce/checkout-status?${new URLSearchParams({
						session_id: sessionId,
						attempt: 'gave-up',
					})}`,
					{ cache: 'no-store' },
				).catch(() => undefined);
				return;
			}

			timeoutId = setTimeout(() => poll(attempt + 1), step.delayMs);
		};

		const poll = async (attempt: number) => {
			try {
				const response = await fetch(
					`/api/commerce/checkout-status?${new URLSearchParams({
						session_id: sessionId,
						attempt: String(attempt),
					})}`,
					{ cache: 'no-store' },
				);
				const next = (await response.json().catch(() => null)) as Status | null;
				if (cancelled) return;

				if (next && next.status !== 'processing') {
					setStatus(next);
					return;
				}
			} catch {
				if (cancelled) return;
			}

			schedule(attempt);
		};

		schedule(0);

		return () => {
			cancelled = true;
			if (timeoutId) clearTimeout(timeoutId);
		};
	}, [sessionId, status.status]);

	if (status.status === 'ready') {
		return (
			<div className="purchase-processing verified">
				<p className="eyebrow">Purchase confirmed</p>
				<h1>You’re in!</h1>
				<p>
					Your Workshop Ticket
					{status.productName ? (
						<>
							{' '}
							for <strong>{status.productName}</strong>
						</>
					) : null}{' '}
					is confirmed and linked to your CodeTV account.
				</p>
				{status.purchaseStatus === 'Restricted' && (
					<p>
						You bought this ticket with regional pricing, so it’s tied to the
						country you bought it from.
					</p>
				)}
				<p>
					We’ll share everything you need before the cohort starts. Questions?
					Email <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.
				</p>
				{status.workshopPath && (
					<a className="button" href={status.workshopPath}>
						Back to the workshop
					</a>
				)}
			</div>
		);
	}

	if (status.status === 'not-paid') {
		return (
			<div className="purchase-processing">
				<h1>Your payment didn’t go through</h1>
				<p>
					Stripe didn’t complete this checkout, so you haven’t been charged.
					Head back to the workshop page to try again, or email{' '}
					<a href={`mailto:${supportEmail}`}>{supportEmail}</a>.
				</p>
			</div>
		);
	}

	if (status.status === 'error') {
		return (
			<div className="purchase-processing">
				<h1>We couldn’t find that checkout</h1>
				<p>
					{status.message} If you were charged, email{' '}
					<a href={`mailto:${supportEmail}`}>{supportEmail}</a> and we’ll sort
					it out.
				</p>
			</div>
		);
	}

	if (phase === 'failed') {
		return (
			<div className="purchase-processing delayed">
				<p className="eyebrow">Payment successful</p>
				<h1>Your payment went through</h1>
				<p>
					We’re having a temporary problem setting up your ticket. You don’t
					need to pay again.
				</p>
				<p>
					If you haven’t received a confirmation email after 20–30 minutes,
					email <a href={`mailto:${supportEmail}`}>{supportEmail}</a> and we’ll
					help as soon as possible.
				</p>
			</div>
		);
	}

	return (
		<div className="purchase-processing" aria-live="polite">
			<p className="eyebrow">Payment received</p>
			<h1>Thanks for your purchase!</h1>
			<p>
				{phase === 'slow'
					? 'Still setting up your ticket…'
					: 'Finalizing your ticket…'}
			</p>
			{phase === 'slow' && (
				<p className="hint">
					This usually takes a few seconds. You can leave this tab open while we
					finish.
				</p>
			)}
		</div>
	);
}
