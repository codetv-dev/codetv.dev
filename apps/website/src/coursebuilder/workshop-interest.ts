/** Public workshop keys and the purchase projection live in one small table. */
export const workshopMarketing = {
	'product-4gmhd': {
		productSlug: 'agentic-frontend-engineering-cohort-1-4gmhd',
		pageSlug: 'agentic-frontend-engineering',
		buyerTag: 25083512,
	},
} as const;

export const interestSignals = [
	'landing',
	'pricing',
	'code',
	'checkout',
] as const;
export type InterestSignal = (typeof interestSignals)[number];
export function isInterestSignal(value: unknown): value is InterestSignal {
	return interestSignals.includes(value as InterestSignal);
}

/** Three UTC dates + three bits + a purchase bit. Bounded, inspectable, no event history. */
export function scoreInterest(
	log: string | undefined,
	signal: InterestSignal | 'purchase',
	now = new Date(),
) {
	const [version, dates = '', bits = '', bought = ''] = (log ?? '').split('|');
	const days =
		version === '1'
			? [
					...new Set(
						dates.split(',').filter((day) => /^\d{4}-\d{2}-\d{2}$/.test(day)),
					),
				]
					.sort()
					.slice(0, 3)
			: [];
	const flags = new Set(
		version === '1' ? [...bits].filter((bit) => 'pcx'.includes(bit)) : [],
	);
	let purchased = version === '1' && bought === '1';
	if (signal === 'purchase') purchased = true;
	if (signal === 'landing' && days.length < 3) {
		const today = now.toISOString().slice(0, 10);
		if (!days.includes(today)) days.push(today);
	}
	if (signal === 'pricing') flags.add('p');
	if (signal === 'code') flags.add('c');
	if (signal === 'checkout') flags.add('x');
	const score = purchased
		? 100
		: days.length * 10 +
			(flags.has('p') ? 10 : 0) +
			(flags.has('c') ? 10 : 0) +
			(flags.has('x') ? 30 : 0);
	return {
		score,
		log: `1|${days.sort().join(',')}|${['p', 'c', 'x'].filter((bit) => flags.has(bit)).join('')}|${purchased ? '1' : '0'}`,
	};
}
