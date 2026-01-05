const ck_api = new URL('https://api.convertkit.com');
const api_key = process.env.KIT_SECRET_KEY;

if (!api_key) {
	console.error(
		'KIT_SECRET_KEY is not set in env. Newsletter activities will not work.',
	);
}

function createApiUrl(pathname: string) {
	const url = new URL(pathname, CK_BASE_URL);
	url.searchParams.set('api_secret', api_key!);
	return url;
}

export async function addSubscriber(first_name: string, email: string) {
	/** @see https://app.convertkit.com/forms/designers/1269192/edit */
	const url = createApiUrl('/v3/forms/1269192/subscribe');

	const response = await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
		},
		body: JSON.stringify({
			api_secret: api_key,
			first_name,
			email,
		}),
	});

	if (!response.ok) {
		console.error(response);
		console.log('Error creating a subscriber');
		throw new Error('Error creating a subscriber');
	}

	// TODO fix the Kit response type
	const data = (await response.json()) as any;

	if (!data.subscription || !data.subscription.id) {
		console.error(data);
		console.error('Failed to create subscriber.');
		throw new Error('Failed to create subscriber.');
	}

	return data.subscription;
}

export async function getSubscriberByEmail(email: string) {
	const url = createApiUrl('/v3/subscribers');
	url.searchParams.set('email_address', email);

	const res = await fetch(url);

	if (!res.ok) {
		console.error(res.statusText);
		throw new Error('error loading subscriber');
	}

	// TODO get Kit return types
	const data = (await res.json()) as any;

	return data.subscribers.at(0);
}

export async function getTags() {
	const url = createApiUrl('/v3/tags');

	const res = await fetch(url);

	if (!res.ok) {
		console.error(res.statusText);
		throw new Error('Error fetching tags');
	}

	const data = (await res.json()) as any;

	return data.tags as Array<{ id: number; name: string }>;
}

export async function tagSubscriber(email: string, tagName: string) {
	if (!tagName) {
		throw new Error('tagName is required to tag a subscriber');
	}

	// Look up the tag ID by name
	const tags = await getTags();
	const tag = tags.find((t) => t.name?.toLowerCase() === tagName.toLowerCase());

	if (!tag) {
		throw new Error(`Tag "${tagName}" not found in ConvertKit`);
	}

	const url = createApiUrl(`/v3/tags/${tag.id}/subscribe`);

	const res = await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
		},
		body: JSON.stringify({
			api_secret: api_key,
			email,
		}),
	});

	if (!res.ok) {
		const errorText = await res.text();
		console.error(`Error tagging subscriber: ${res.status} ${res.statusText}`);
		console.error(errorText);
		throw new Error(`Error tagging subscriber: ${res.statusText}`);
	}

	const data = (await res.json()) as any;

	return data.subscription;
}