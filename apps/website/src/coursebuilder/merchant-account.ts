import { eq } from 'drizzle-orm';

import { db } from '../db';
import { merchantAccount } from '../db/schema';

const STRIPE_MERCHANT_ACCOUNT_ID = 'ctv-stripe-merchant-account';

export async function ensureStripeMerchantAccount() {
	const existing = await db.query.merchantAccount.findFirst({
		where: eq(merchantAccount.label, 'stripe'),
	});

	if (existing) return existing;

	await db.insert(merchantAccount).values({
		id: STRIPE_MERCHANT_ACCOUNT_ID,
		label: 'stripe',
		identifier:
			process.env.STRIPE_ACCOUNT_ID ??
			process.env.STRIPE_MERCHANT_ACCOUNT_ID ??
			STRIPE_MERCHANT_ACCOUNT_ID,
		status: 1,
	});

	return db.query.merchantAccount.findFirst({
		where: eq(merchantAccount.id, STRIPE_MERCHANT_ACCOUNT_ID),
	});
}
