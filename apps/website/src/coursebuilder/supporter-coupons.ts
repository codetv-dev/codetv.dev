/** Site coupon ids, not Stripe merchant coupon ids. Active Gold and Platinum only. */
export const SUPPORTER_ONLY_COUPON_IDS = new Set(['coupon_hw5vh']);

export const MEMBER_WORKSHOPS: Record<
	string,
	{ couponId: string; path: string }
> = {
	'product-4gmhd': {
		couponId: 'coupon_hw5vh',
		path: '/workshops/agentic-frontend-engineering',
	},
};

/** Whether the supporter qualifies for member workshop pricing. */
export function isActiveSupporter(user: unknown): boolean {
	const stripe = (
		user as {
			publicMetadata?: { stripe?: { status?: string; level?: string } };
		} | null
	)?.publicMetadata?.stripe;
	return (
		stripe?.status === 'active' &&
		(stripe.level === 'Gold Tier Supporter' ||
			stripe.level === 'Platinum Tier Supporter')
	);
}

export function memberCheckoutPath(productId: string): string | null {
	return MEMBER_WORKSHOPS[productId]
		? `/api/coursebuilder/member-checkout?${new URLSearchParams({ productId })}`
		: null;
}
