export type Chapter = {
	id: string;
	slug: string;
	title: string;
	startsAt: string | null;
};

/** Missing or malformed schedules fail closed, rather than releasing early. */
export function isChapterUnlocked(startsAt: string | null, now = new Date()) {
	return Boolean(
		startsAt &&
		Number.isFinite(Date.parse(startsAt)) &&
		Date.parse(startsAt) <= now.getTime(),
	);
}

export function chapterUnlockLabel(startsAt: string | null) {
	if (!startsAt || !Number.isFinite(Date.parse(startsAt)))
		return 'Release date to be announced';
	return `Unlocks ${new Intl.DateTimeFormat('en-US', {
		timeZone: 'America/Los_Angeles',
		weekday: 'short',
		month: 'short',
		day: 'numeric',
	}).format(new Date(startsAt))} (Pacific)`;
}

export const privateLessonHeaders = {
	'Cache-Control': 'private, no-store',
	'Netlify-CDN-Cache-Control': 'no-store',
	'CDN-Cache-Control': 'no-store',
};

/** Load video data only after both gates pass. Never fall back to public Mux. */
export async function getLessonPlayback({
	hasTicket,
	startsAt,
	now = new Date(),
	loadVideo,
}: {
	hasTicket: boolean;
	startsAt: string | null;
	now?: Date;
	loadVideo: () => Promise<unknown>;
}): Promise<{ id: string; policy: 'signed' } | null> {
	if (!hasTicket || !isChapterUnlocked(startsAt, now)) return null;
	const fields = (await loadVideo()) as Record<string, unknown> | null;
	const ids = fields?.playback_ids;
	if (!Array.isArray(ids)) return null;
	const signed = ids.find(
		(value) =>
			value?.policy === 'signed' && typeof value.id === 'string' && value.id,
	);
	return signed ? { id: signed.id, policy: 'signed' } : null;
}

/** Public APIs expose chapter metadata, never exercise bodies or video resources.
 * Recurse through relation wrappers as well as resources so nested APIs are safe.
 */
export function publicWorkshopContent(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(publicWorkshopContent);
	if (!value || typeof value !== 'object' || value instanceof Date)
		return value;
	const node = value as Record<string, unknown>;
	if (
		typeof node.type === 'string' &&
		['lesson', 'section', 'videoResource'].includes(node.type)
	) {
		const fields = (node.fields ?? {}) as Record<string, unknown>;
		return {
			id: node.id,
			slug: node.slug,
			type: node.type,
			fields: Object.fromEntries(
				['title', 'slug', 'startsAt', 'state', 'visibility']
					.filter((key) => key in fields)
					.map((key) => [key, fields[key]]),
			),
			...(node.resources
				? { resources: publicWorkshopContent(node.resources) }
				: {}),
		};
	}
	return Object.fromEntries(
		Object.entries(node).map(([key, item]) => [
			key,
			publicWorkshopContent(item),
		]),
	);
}
