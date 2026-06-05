import IconLink from '../components/icons/social-link.svg';
import IconInstagram from '../components/icons/social-instagram.svg';
import IconBluesky from '../components/icons/social-bluesky.svg';
import IconLinkedIn from '../components/icons/social-linkedin.svg';
import IconYouTube from '../components/icons/social-youtube.svg';
import IconX from '../components/icons/social-x.svg';

const DAY_IN_MS = 86_400_000;

export function getRelativeAge(date: string, days: number = 7) {
	const now = new Date().getTime();
	const ts = new Date(date).getTime();

	// first, figure out if this is in the future
	if (now < ts) {
		return 'FUTURE';
	}

	// next, figure out if it was published recently enough to be considered “new”
	if (ts > now - DAY_IN_MS * days) {
		return 'NEW';
	}

	// otherwise, it’s just a regular ol’ episode
	return 'PAST';
}

export function isNew(date: string, days: number = 7) {
	// magic numbers to determine if an episode was published within the last N days
	const cutoff = new Date().getTime() - DAY_IN_MS * days;
	const timestamp = new Date(date).getTime();

	return timestamp > cutoff;
}

export function truncate(
	str: string,
	{
		letter_count = 60,
		word_count = 10,
	}: { letter_count?: number; word_count?: number } = {},
) {
	const letters = str.split('').slice(0, letter_count).join('');
	const words =
		str.length > letters.length
			? letters.split(' ').slice(0, -1)
			: letters.split(' ');

	return str.length > words.join(' ').length
		? words.slice(0, word_count).join(' ') + '...'
		: words.join(' ');
}

export function socialLinkExtraction(link: { url: string; label: string }) {
	const url = new URL(link.url);

	let icon;
	let label;

	switch (url.hostname.replace(/^www\./, '')) {
		case 'bsky.app':
			icon = IconBluesky;
			label = `@` + url.pathname.replace('/profile/', '');
			break;

		case 'instagram.com':
			icon = IconInstagram;
			label = `@` + url.pathname.replace('/', '');
			break;

		case 'youtube.com':
			icon = IconYouTube;
			label = url.pathname.replace('/', '');
			break;

		case 'twitter.com':
		case 'x.com':
			icon = IconX;
			label = `@` + url.pathname.replace('/', '');
			break;

		case 'linkedin.com':
			icon = IconLinkedIn;
			label = 'LinkedIn';
			break;

		default:
			icon = IconLink;
			label = url.hostname + url.pathname.replace(/\/$/, '');
			break;
	}

	return { Icon: icon, url, label };
}
