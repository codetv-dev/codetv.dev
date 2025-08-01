import Stripe from 'stripe';
import type { User } from '@codetv/clerk';

export type { Stripe } from 'stripe';

const secret = process.env.STRIPE_SECRET_KEY;

if (!secret) {
	console.error(
		'STRIPE_SECRET_KEY is not set in env. Payment features will not work.',
	);
}

export const stripe = new Stripe(secret ?? 'sk_test_123');

export const STRIPE_SUBSCRIPTION_TYPES = [
	{
		name: 'Silver',
		description:
			'Get early access to new episodes, and directly fund the creation of new content.',
		prices: [
			{
				period: 'monthly',
				price: 5_00,
				priceId: process.env.TIER_SILVER_PRICE_ID,
			},
			{
				period: 'yearly',
				price: 55_00,
				priceId: 'price_1Rb7tQJ4VGTQR05O6ICKiAgi',
			},
		],
	},
	{
		name: 'Gold',
		description:
			'All the perks of the silver tier + a 20% discount on courses and workshops.',
		prices: [
			{
				period: 'monthly',
				price: 20_00,
				priceId: process.env.TIER_GOLD_PRICE_ID,
			},
			{
				period: 'yearly',
				price: 220_00,
				priceId: 'price_1Rb7u0J4VGTQR05OlNNhThIx',
			},
		],
	},
	// {
	// 	name: 'Platinum',
	// 	description:
	// 		'All the perks of the gold tier + the option to book a 30-minute monthly strategy call.',
	// 	prices: [
	// 		{
	// 			period: 'monthly',
	// 			price: 100_00,
	// 			priceId: TIER_PLATINUM_PRICE_ID,
	// 		},
	// 	],
	// },
];

export async function validateWebhookSignature(
	request: Request,
): Promise<Stripe.Event | Response> {
	if (!process.env.STRIPE_WEBHOOK_SECRET) {
		throw new Error('must set STRIPE_WEBHOOK_SECRET in env');
	}
	const signature = request.headers.get('stripe-signature');

	if (!signature) {
		return new Response(null, {
			status: 400,
		});
	}

	let event;
	try {
		event = stripe.webhooks.constructEvent(
			await request.text(),
			signature,
			process.env.STRIPE_WEBHOOK_SECRET,
		);
	} catch (error) {
		if (error instanceof Error) {
			return new Response(
				JSON.stringify({
					error: error.message,
				}),
				{
					status: 400,
				},
			);
		}
	}

	if (!event) {
		return new Response(null, {
			status: 400,
		});
	}

	return event;
}

export async function getSubscriptionStatus(user: User | null) {
	if (
		!user ||
		!user.publicMetadata.stripe ||
		!user.publicMetadata.stripe.status
	) {
		return null;
	}

	return user.publicMetadata.stripe.status;
}

export async function getSubscriptionDetails(user: User | null) {
	if (
		!user ||
		!user.publicMetadata.stripe ||
		!user.publicMetadata.stripe.customer
	) {
		return null;
	}

	const subList = await stripe.subscriptions.list({
		customer: user.publicMetadata.stripe.customer,
	});

	return subList.data.at(0);
}
