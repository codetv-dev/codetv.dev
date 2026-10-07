import { useEffect, useMemo, useState } from 'react';

import type { EnrollmentState } from '../../coursebuilder/enrollment';

/**
 * Pricing block for a Workshop Ticket.
 *
 * Prices come from CourseBuilder's `prices-formatted` action, which applies the
 * default (early bird) coupon, a `?code=` coupon, and PPP. The browser sends
 * only the site coupon id and whether the buyer opted into PPP; the server
 * decides the country and the merchant coupon for both pricing and checkout
 * (see src/coursebuilder/checkout-coupons.ts).
 *
 * TODO: team seats (quantity > 1) and the Team Claim Link redeem flow. Port
 * ai-hero/apps/ai-hero/src/app/(content)/cohorts/[slug]/_components/cohort-pricing-widget-container.tsx.
 */

type MerchantCoupon = {
	id: string;
	type: string;
	percentageDiscount?: number | string | null;
	amountDiscount?: number | null;
	country?: string;
	merchantAccountId?: string;
	status?: number;
};

type FormattedPrice = {
	unitPrice: number;
	fullPrice: number;
	calculatedPrice: number;
	appliedMerchantCoupon?: MerchantCoupon;
	appliedDiscountType?: 'ppp' | 'bulk' | 'fixed' | 'percentage' | 'none';
	appliedCouponLabel?: string;
	availableCoupons?: Array<MerchantCoupon | undefined>;
	usedCouponId?: string;
};

export type WorkshopPricingProps = {
	productId: string;
	listPrice: number | null;
	enrollment: {
		state: EnrollmentState;
		opensAt: string | null;
		closesAt: string | null;
	};
	couponId: string | null;
	canCheckout: boolean;
	hasTicket: boolean;
	checkoutNotice: string | null;
	returnUrl: string;
	/** Dev-only PPP override, forwarded from `?ppp_country=`. */
	devCountry: string | null;
};

const usd = new Intl.NumberFormat('en-US', {
	style: 'currency',
	currency: 'USD',
	maximumFractionDigits: 0,
});

// `dateStyle`/`timeStyle` can't be combined with `timeZoneName`.
const dateFormat = new Intl.DateTimeFormat('en-US', {
	month: 'long',
	day: 'numeric',
	year: 'numeric',
	hour: 'numeric',
	minute: '2-digit',
	timeZone: 'America/Los_Angeles',
	timeZoneName: 'short',
});

const notices: Record<string, string> = {
	'sign-in-required': 'Sign in to buy a ticket.',
	'enrollment-closed': 'Ticket sales for this cohort are closed.',
	'already-purchased': 'You already have a ticket for this cohort.',
	error:
		'We couldn’t start checkout. Please try again, or email info@codetv.dev.',
};

function percentOff(coupon?: MerchantCoupon) {
	const value = Number(coupon?.percentageDiscount ?? 0);
	return Math.round(value * 100);
}

export function WorkshopPricing({
	productId,
	listPrice,
	enrollment,
	couponId,
	canCheckout,
	hasTicket,
	checkoutNotice,
	returnUrl,
	devCountry,
}: WorkshopPricingProps) {
	const [price, setPrice] = useState<FormattedPrice | null>(null);
	const [ppp, setPpp] = useState(false);
	const [loading, setLoading] = useState(true);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		let cancelled = false;
		setLoading(true);

		const endpoint = new URL(
			'/api/coursebuilder/prices-formatted',
			window.location.origin,
		);
		if (devCountry) endpoint.searchParams.set('ppp_country', devCountry);

		fetch(endpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				productId,
				...(couponId && { couponId }),
				ppp,
			}),
		})
			.then(async (response) => {
				if (!response.ok)
					throw new Error(`prices-formatted ${response.status}`);
				return (await response.json()) as FormattedPrice;
			})
			.then((formatted) => {
				if (cancelled) return;
				setPrice(formatted);
				setFailed(false);
			})
			.catch((error) => {
				if (cancelled) return;
				console.error('workshop-pricing.failed', error);
				setFailed(true);
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [productId, couponId, ppp, devCountry]);

	const pppOffer = useMemo(
		() =>
			price?.availableCoupons?.find(
				(coupon): coupon is MerchantCoupon => coupon?.type === 'ppp',
			) ?? null,
		[price],
	);

	const pppApplied = price?.appliedMerchantCoupon?.type === 'ppp';
	const discounted =
		price && price.calculatedPrice < price.fullPrice ? price : null;

	const checkoutAction = useMemo(() => {
		const params = new URLSearchParams({ productId, cancelUrl: returnUrl });
		if (couponId) params.set('usedCouponId', couponId);
		if (pppApplied) params.set('ppp', '1');
		if (devCountry) params.set('ppp_country', devCountry);
		return `/api/coursebuilder/checkout/stripe?${params.toString()}`;
	}, [productId, returnUrl, couponId, pppApplied, devCountry]);

	const opensAt = enrollment.opensAt ? new Date(enrollment.opensAt) : null;
	const closesAt = enrollment.closesAt ? new Date(enrollment.closesAt) : null;
	const notice = checkoutNotice ? notices[checkoutNotice] : null;

	return (
		<div className="workshop-pricing" aria-busy={loading}>
			{notice && (
				<p className="notice" role="status">
					{notice}
				</p>
			)}

			<p className="price">
				{discounted ? (
					<>
						<span className="amount">
							{usd.format(discounted.calculatedPrice)}
						</span>{' '}
						<s className="full">{usd.format(discounted.fullPrice)}</s>
					</>
				) : (
					<span className="amount">
						{price
							? usd.format(price.calculatedPrice)
							: listPrice !== null
								? usd.format(listPrice)
								: '—'}
					</span>
				)}
			</p>

			{discounted && price?.appliedMerchantCoupon && (
				<p className="discount">
					{pppApplied
						? `Regional pricing: ${percentOff(price.appliedMerchantCoupon)}% off`
						: (price.appliedCouponLabel ??
							(percentOff(price.appliedMerchantCoupon) > 0
								? `${percentOff(price.appliedMerchantCoupon)}% off applied`
								: 'Discount applied'))}
				</p>
			)}

			{failed && (
				<p className="notice">
					We couldn’t load the latest price. Refresh to try again.
				</p>
			)}

			{enrollment.state === 'open' &&
				!hasTicket &&
				(pppOffer || pppApplied) && (
					<label className="ppp">
						<input
							type="checkbox"
							checked={pppApplied}
							disabled={loading}
							onChange={(event) => setPpp(event.target.checked)}
						/>{' '}
						{pppApplied
							? 'Regional pricing applied.'
							: `We noticed you’re in ${pppOffer?.country ?? 'a country with regional pricing'}. Apply ${percentOff(pppOffer ?? undefined)}% regional pricing?`}{' '}
						Regional pricing is only for people who live there.
					</label>
				)}

			{hasTicket ? (
				<p className="status">You have a ticket for this cohort.</p>
			) : enrollment.state === 'not-yet-open' ? (
				<p className="status">
					Ticket sales open
					{opensAt ? ` ${dateFormat.format(opensAt)}` : ' soon'}.
				</p>
			) : enrollment.state === 'closed' ? (
				<p className="status">Ticket sales for this cohort are closed.</p>
			) : canCheckout ? (
				<form method="POST" action={checkoutAction}>
					<button type="submit" className="button" disabled={loading || failed}>
						Buy a ticket
					</button>
				</form>
			) : null}

			{enrollment.state === 'open' && closesAt && !hasTicket && (
				<p className="closes">Sales close {dateFormat.format(closesAt)}.</p>
			)}
		</div>
	);
}
