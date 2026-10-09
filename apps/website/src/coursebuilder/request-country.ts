import type { APIContext, AstroGlobal } from 'astro';

/**
 * Country used for PPP pricing and checkout.
 *
 * Never trust a country sent by the browser. On Netlify the edge geolocates
 * the request (`locals.netlify.context.geo`). Locally there is no geo, so
 * `astro dev` accepts `?ppp_country=XX` to exercise PPP by hand.
 */
export function getTrustedCountry(
	context: Pick<APIContext | AstroGlobal, 'locals' | 'url'>,
): string {
	const locals = context.locals as {
		netlify?: { context?: { geo?: { country?: { code?: string } } } };
	};
	const netlifyCountry = locals.netlify?.context?.geo?.country?.code;
	const devCountry = import.meta.env.DEV
		? context.url.searchParams.get('ppp_country')
		: null;

	const country = (
		netlifyCountry ??
		devCountry ??
		process.env.DEFAULT_COUNTRY ??
		'US'
	).toUpperCase();

	return /^[A-Z]{2}$/.test(country) ? country : 'US';
}
