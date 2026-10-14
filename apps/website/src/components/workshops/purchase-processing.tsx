import { useEffect, useRef, useState } from 'react';
import type {
	CheckoutStatus,
	PollPhase,
} from '../../coursebuilder/purchase-polling';
import {
	isCheckoutStatus,
	startPurchaseWait,
} from '../../coursebuilder/purchase-wait';

type Status = CheckoutStatus & { workshopPath?: string | null };
type PurchaseProcessingProps = {
	sessionId: string;
	initialStatus: Status;
	supportEmail: string;
	signedIn?: boolean;
};

export function PurchaseProcessing({
	sessionId,
	initialStatus,
	supportEmail,
	signedIn = false,
}: PurchaseProcessingProps) {
	const [status, setStatus] = useState<Status>(initialStatus);
	const [phase, setPhase] = useState<PollPhase>(
		initialStatus.status === 'error' || initialStatus.status === 'not-paid'
			? 'failed'
			: 'processing',
	);
	const [retry, setRetry] = useState(0);
	const heading = useRef<HTMLHeadingElement>(null);
	const ready = status.status === 'ready';
	const support = !ready && phase === 'failed';
	const paid =
		ready ||
		(status.status === 'processing' && status.paymentStatus === 'paid');

	useEffect(() => {
		if (initialStatus.status !== 'processing' && retry === 0) return;
		return startPurchaseWait({
			check: async (attempt, signal) => {
				const response = await fetch(
					`/api/commerce/checkout-status?${new URLSearchParams({ session_id: sessionId, attempt: String(attempt) })}`,
					{ cache: 'no-store', signal },
				);
				if (!response.ok) return null;
				const next: unknown = await response.json();
				return isCheckoutStatus(next) ? next : null;
			},
			onStatus: setStatus,
			onPhase: setPhase,
		});
	}, [sessionId, initialStatus.status, retry]);

	useEffect(() => {
		if (phase !== 'slow' && phase !== 'failed') return;
		// Best-effort telemetry cannot hold the waiting lifecycle open.
		void fetch(
			`/api/commerce/checkout-status?${new URLSearchParams({
				session_id: sessionId,
				attempt: phase === 'slow' ? 'slow' : 'gave-up',
			})}`,
			{ cache: 'no-store', keepalive: true, signal: AbortSignal.timeout(5000) },
		).catch(() => undefined);
	}, [phase, sessionId]);

	useEffect(() => {
		if (ready || support) heading.current?.focus();
	}, [ready, support]);

	const retryCheck = () => {
		// Preserve payment evidence, but give every retry its own 90-second deadline.
		setStatus({ status: 'processing', paymentStatus: paid ? 'paid' : null });
		setPhase('processing');
		setRetry((attempt) => attempt + 1);
	};
	const title = ready
		? 'Your ticket is confirmed'
		: support
			? 'Let’s check your ticket'
			: 'Finalizing your ticket';
	const supportHref = `mailto:${supportEmail}?${new URLSearchParams({ subject: 'Workshop ticket help', body: `Please help me check my workshop ticket.\nCheckout reference: ${sessionId}` })}`;

	return (
		<section
			className={`purchase-processing${ready ? ' verified' : support ? ' delayed' : ''}`}
			aria-labelledby="purchase-heading"
			data-state={ready ? 'ready' : phase}
		>
			<p className="eyebrow">
				{ready
					? 'Purchase confirmed'
					: paid
						? 'Payment received'
						: 'Workshop ticket'}
			</p>
			<h1 id="purchase-heading" ref={heading} tabIndex={-1}>
				{title}
			</h1>
			<div role="status" aria-live="polite" aria-atomic="true">
				{ready && !signedIn ? (
					<p>
						You’re in. Sign in or create your CodeTV account
						{status.buyerEmail ? (
							<>
								{' '}
								with <strong>{status.buyerEmail}</strong>
							</>
						) : null}{' '}
						to get your ticket.
					</p>
				) : ready ? (
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
				) : support ? (
					<p>
						{paid
							? 'Your payment went through, but we haven’t confirmed your ticket yet. You don’t need to pay again.'
							: 'We haven’t confirmed your ticket yet. This does not mean your payment failed. Please check with us before paying again.'}
					</p>
				) : (
					<p>
						{phase === 'slow'
							? 'This is taking longer than usual. We’re still checking your ticket.'
							: 'We’re checking your ticket. This usually takes a few seconds.'}
					</p>
				)}
			</div>
			{ready && status.purchaseStatus === 'Restricted' && (
				<p>
					You bought this ticket with regional pricing, so it’s tied to the
					country you bought it from.
				</p>
			)}
			{ready && (
				<p>
					We’ll share everything you need before the cohort starts. Questions?
					Email <a href={supportHref}>{supportEmail}</a>.
				</p>
			)}
			{support && (
				<>
					<p>You can check again or email us with your checkout reference.</p>
					<div className="purchase-actions">
						<button type="button" className="button" onClick={retryCheck}>
							Check again
						</button>
						<a href={supportHref}>Email {supportEmail}</a>
					</div>
				</>
			)}
			{ready && !signedIn && (
				<a
					className="button"
					href={`/dashboard/sign-in?${new URLSearchParams({ redirect_url: status.workshopPath ?? '/dashboard' })}`}
				>
					Sign in or create an account
				</a>
			)}
			{ready && status.workshopPath && (
				<a
					className={signedIn ? 'button' : undefined}
					href={status.workshopPath}
				>
					Back to the workshop
				</a>
			)}
		</section>
	);
}
