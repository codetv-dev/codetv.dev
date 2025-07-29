if (!process.env.CONVERTKIT_SECRET_KEY) {
	throw new Error('must set CONVERTKIT_SECRET_KEY in env');
}

const ck_api = new URL('https://api.convertkit.com');

ck_api.searchParams.set('api_secret', process.env.CONVERTKIT_SECRET_KEY);

export async function addSubscriber(first_name: string, email: string) {
	/** @see https://app.convertkit.com/forms/designers/1269192/edit */
	ck_api.pathname = '/v3/forms/1269192/subscribe';

	const response = await fetch(ck_api, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
		},
		body: JSON.stringify({
			api_key: process.env.CONVERTKIT_SECRET_KEY,
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
	ck_api.pathname = '/v3/subscribers';
	ck_api.searchParams.set('email_address', email);

	const res = await fetch(ck_api);

	if (!res.ok) {
		console.error(res.statusText);
		throw new Error('error loading subscriber');
	}

	// TODO get Kit return types
	const data = (await res.json()) as any;

	return data.subscribers.at(0);
}
