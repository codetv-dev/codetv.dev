export * from './sanity.ts';

export type UnwrapArray<A> = A extends unknown[] ? UnwrapArray<A[number]> : A;

export type SubscriptionLevel =
	| 'Free Tier Supporter'
	| 'Silver Tier Supporter'
	| 'Gold Tier Supporter'
	| 'Platinum Tier Supporter';
