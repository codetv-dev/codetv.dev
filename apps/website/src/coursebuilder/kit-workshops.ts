import { format } from 'date-fns';
import {
	scoreInterest,
	workshopMarketing,
	type InterestSignal,
} from './workshop-interest.ts';

type Subscriber = {
	id: number;
	email_address: string;
	fields: Record<string, string | undefined>;
};
type Tag = { id: number; name: string };
const optedOutTag = 25091646;

/** Kit v3 adapter: the deployed KIT_SECRET_KEY is a v3 secret, not a v4 API key. */
export function createWorkshopKit({
	apiSecret,
	fetcher = fetch,
	timeoutMs = 4000,
}: {
	apiSecret: string | undefined;
	fetcher?: typeof fetch;
	timeoutMs?: number;
}) {
	async function session<T>(
		fn: (api: ReturnType<typeof client>) => Promise<T>,
	) {
		if (!apiSecret) throw new Error('KIT_SECRET_KEY is required');
		return fn(client(AbortSignal.timeout(timeoutMs)));
	}
	function client(signal: AbortSignal) {
		async function request(
			path: string,
			method = 'GET',
			body: Record<string, unknown> = {},
		): Promise<any> {
			const url = new URL(`https://api.convertkit.com/v3${path}`);
			if (method === 'GET') url.searchParams.set('api_secret', apiSecret!);
			let response: Response;
			try {
				response = await fetcher(url, {
					method,
					signal,
					headers: { 'Content-Type': 'application/json' },
					...(method !== 'GET' && {
						body: JSON.stringify({ ...body, api_secret: apiSecret }),
					}),
				});
			} catch {
				// Fetch errors can include the credential-bearing read URL. Never propagate it.
				throw new Error('Kit request failed');
			}
			if (!response.ok)
				throw new Error(`Kit ${method} failed (${response.status})`);
			return response.status === 204 ? {} : response.json();
		}
		async function list<T>(path: string, key: string): Promise<T[]> {
			const items: T[] = [];
			for (let page = 1; ; page++) {
				const result = await request(
					`${path}${path.includes('?') ? '&' : '?'}page=${page}`,
				);
				items.push(...result[key]);
				if (!result.total_pages || page >= result.total_pages) return items;
			}
		}
		async function ensureFields(keys: string[]) {
			const fields = await list<{ key: string }>(
				'/custom_fields',
				'custom_fields',
			);
			for (const key of keys) {
				if (!fields.some((field) => field.key === key)) {
					const field = await request('/custom_fields', 'POST', { label: key });
					if (field.key !== key)
						throw new Error('Kit custom field key mismatch');
				}
			}
		}
		async function ensureTag(name: string, allTags: Tag[]) {
			return (
				allTags.find((tag) => tag.name === name) ??
				((await request('/tags', 'POST', { tag: { name } })) as Tag)
			);
		}
		async function addTag(subscriber: Subscriber, tags: Tag[], id: number) {
			// No remove/re-add: only new membership triggers the welcome.
			if (tags.some((tag) => tag.id === id)) return;
			await request(`/tags/${id}/subscribe`, 'POST', {
				email: subscriber.email_address,
			});
			tags.push({ id, name: '' });
		}
		async function bands(subscriber: Subscriber, tags: Tag[], score: number) {
			if (score < 20) return;
			const allTags = await list<Tag>('/tags', 'tags');
			for (const [name, minimum] of [
				['afe-warm', 20],
				['afe-hot', 50],
			] as const) {
				if (score < minimum) continue;
				const tag = await ensureTag(name, allTags);
				await addTag(subscriber, tags, tag.id);
			}
		}
		async function update(
			subscriber: Subscriber,
			fields: Record<string, string>,
		) {
			await request(`/subscribers/${subscriber.id}`, 'PUT', { fields });
		}
		return { request, list, ensureFields, ensureTag, addTag, bands, update };
	}

	return {
		async purchase({
			email,
			productId,
			slug,
			purchasedAt,
		}: {
			email: string;
			productId: string;
			slug: string;
			purchasedAt: Date;
		}) {
			return session(async (api) => {
				const matches = await api.list<Subscriber>(
					`/subscribers?email_address=${encodeURIComponent(email)}`,
					'subscribers',
				);
				let subscriber = matches.find(
					(subscriber) =>
						subscriber.email_address.toLowerCase() === email.toLowerCase(),
				);
				const tags = subscriber
					? await api.list<Tag>(`/subscribers/${subscriber.id}/tags`, 'tags')
					: [];
				const field = `purchased_${slug.replace(/-/g, '_')}_on`;
				const optedOut = tags.some((tag) => tag.id === optedOutTag);
				await api.ensureFields([
					field,
					...(!optedOut ? ['afe_interest', 'afe_interest_log'] : []),
				]);
				const fields: Record<string, string> = {
					[field]: format(purchasedAt, 'yyyy-MM-dd HH:mm:ss z'),
				};
				if (!optedOut) {
					const interest = scoreInterest(
						subscriber?.fields?.afe_interest_log,
						'purchase',
					);
					fields.afe_interest = String(interest.score);
					fields.afe_interest_log = interest.log;
				}
				const config =
					workshopMarketing[productId as keyof typeof workshopMarketing];
				if (!subscriber) {
					// V3 creates active subscribers through tag subscription. Include the projection
					// on that same write so the welcome automation can see the purchase fields.
					const buyerTag =
						config?.buyerTag ??
						(
							await api.ensureTag(
								'codetv-workshop-buyer',
								await api.list<Tag>('/tags', 'tags'),
							)
						).id;
					const { subscription } = await api.request(
						`/tags/${buyerTag}/subscribe`,
						'POST',
						{ email, fields },
					);
					subscriber = {
						id: subscription.subscriber.id,
						email_address: email,
						fields,
					};
					tags.push({ id: buyerTag, name: '' });
				} else {
					await api.update(subscriber, fields);
					if (config) await api.addTag(subscriber, tags, config.buyerTag);
				}
				if (!optedOut) await api.bands(subscriber, tags, 100);
			});
		},
		async interest(subscriberId: string, signal: InterestSignal) {
			return session(async (api) => {
				const { subscriber } = (await api.request(
					`/subscribers/${subscriberId}`,
				)) as { subscriber: Subscriber };
				const tags = await api.list<Tag>(
					`/subscribers/${subscriber.id}/tags`,
					'tags',
				);
				if (tags.some((tag) => tag.id === optedOutTag)) return;
				const currentLog = subscriber.fields?.afe_interest_log;
				const interest = scoreInterest(currentLog, signal);
				const purchased = Object.entries(subscriber.fields ?? {}).some(
					([key, value]) => key.startsWith('purchased_') && value,
				);
				const score =
					purchased || subscriber.fields?.afe_interest === '100'
						? 100
						: interest.score;
				if (
					interest.log !== currentLog ||
					subscriber.fields?.afe_interest !== String(score)
				) {
					await api.ensureFields(['afe_interest', 'afe_interest_log']);
					await api.update(subscriber, {
						afe_interest: String(score),
						afe_interest_log: interest.log,
					});
				}
				await api.bands(subscriber, tags, score);
			});
		},
	};
}

export function workshopKit() {
	return createWorkshopKit({ apiSecret: process.env.KIT_SECRET_KEY });
}
