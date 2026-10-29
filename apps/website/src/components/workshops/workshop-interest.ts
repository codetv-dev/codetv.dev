import {
	scoreInterest,
	workshopMarketing,
	type InterestSignal,
} from '../../coursebuilder/workshop-interest.ts';

let pending = Promise.resolve();

/** Only the browser reads the visitor's URL/storage. Never part of the cached shell. */
export function trackWorkshopInterest(signal: InterestSignal) {
	try {
		const workshop = decodeURIComponent(location.pathname.split('/')[2] ?? '');
		if (
			!Object.values(workshopMarketing).some(
				(config) => config.pageSlug === workshop,
			)
		)
			return;
		const supplied = new URLSearchParams(location.search).get(
			'ck_subscriber_id',
		);
		if (supplied && /^[1-9]\d{0,19}$/.test(supplied))
			sessionStorage.setItem('workshop-subscriber', supplied);
		const subscriberId = sessionStorage.getItem('workshop-subscriber');
		if (!subscriberId) return;
		const key = `workshop-interest:${workshop}:${subscriberId}`;
		const previous = localStorage.getItem(key) ?? undefined;
		const next = scoreInterest(previous, signal);
		if (next.log === previous) return;
		// This is only a traffic hint. The Kit log remains the server-side cap.
		localStorage.setItem(key, next.log);
		const send = async () => {
			await fetch('/api/workshops/interest', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ subscriberId, signal, workshop }),
				keepalive: true,
			}).catch(() => {});
		};
		// Checkout navigates away now: start keepalive before the document unloads.
		// Other signals queue to avoid racing landing/code/pricing on this page.
		if (signal === 'checkout') void send();
		else pending = pending.then(send);
	} catch {
		// Disabled storage, malformed URLs and marketing outages must not affect checkout.
	}
}

export function watchWorkshopInterest() {
	const params = new URLSearchParams(location.search);
	if (/^[1-9]\d{0,19}$/.test(params.get('ck_subscriber_id') ?? ''))
		trackWorkshopInterest('landing');
	if (params.has('code')) trackWorkshopInterest('code');
	const pricing = document.getElementById('ticket');
	if (!pricing || !('IntersectionObserver' in window)) return;
	const observer = new IntersectionObserver((entries) => {
		if (!entries.some((entry) => entry.isIntersecting)) return;
		trackWorkshopInterest('pricing');
		observer.disconnect();
	});
	observer.observe(pricing);
	document.addEventListener('astro:before-swap', () => observer.disconnect(), {
		once: true,
	});
}
