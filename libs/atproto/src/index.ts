import { Client, type BlobRef } from '@atproto/lex';
import { PasswordSession } from '@atproto/lex-password-session';
import { site } from './lexicons/index.ts';
import { createHash } from 'node:crypto';

if (!process.env.BLUESKY_USERNAME) {
	console.error('No Bluesky username provided. Add BLUESKY_USERNAME in .env');
}

if (!process.env.BLUESKY_PASSWORD) {
	console.error('No Bluesky password provided. Add BLUESKY_PASSWORD in .env');
}

if (!process.env.BLUESKY_USERNAME || !process.env.BLUESKY_PASSWORD) {
	throw new Error('Missing Bluesky credentials');
}

const session = await PasswordSession.login({
	service: 'https://bsky.social',
	identifier: process.env.BLUESKY_USERNAME,
	password: process.env.BLUESKY_PASSWORD,
});

const client = new Client(session);

export async function createBlobFromImageUrl(
	url: string,
): Promise<BlobRef | undefined> {
	const res = await fetch(url);

	if (!res.ok) {
		console.error(res.statusText);
		throw new Error('unable to load image');
	}

	const arrayBuffer = await res.arrayBuffer();
	const uint8Array = new Uint8Array(arrayBuffer);
	const encoding = res.headers.get('content-type') as `${string}/${string}`;

	const response = await client.uploadBlob(uint8Array, { encoding });

	if (!response.body) {
		return undefined;
	}

	return response.body.blob;
}

export async function checkForPublication(str: string) {
	const rkey = createRkeyFromString(str);
	console.log({ rkey });
	try {
		const response = await client.getRecord(
			site.standard.publication.main.$type,
			rkey,
			{
				repo: client.did,
			},
		);

		return response.body.uri;
	} catch (err) {
		console.error(err);
		return false;
	}
}

export function createPublicationRecord({
	url,
	name,
	description,
	icon,
}: {
	url: `${string}:${string}`;
	name: string;
	description: string;
	icon?: BlobRef | undefined;
}) {
	return site.standard.publication.$build({
		url,
		name,
		description,
		icon,
		preferences: {
			showInDiscover: true,
		},
	});
}

export async function createPublication(
	publication: site.standard.publication.Main,
	rkey?: string | undefined,
): Promise<string | undefined> {
	const result = await client.create(site.standard.publication, publication, {
		rkey,
	});

	if (!result || !result.uri) {
		console.error('Error creating the publication');
		console.error(result);
	}

	return result.uri;
}

export async function createDocument(
	document: site.standard.document.Main,
	rkey?: string | undefined,
): Promise<string | undefined> {
	const result = await client.create(site.standard.document, document, {
		rkey,
	});

	if (!result || !result.uri) {
		console.error('Error creating the publication');
		console.error(result);
	}

	return result.uri;
}

function createRkeyFromString(str: string) {
	// this is NOT for security; we just need a deterministic rkey
	const hash = createHash('md5');
	hash.update(str);
	const digest = hash.digest('base64url');

	return digest.substring(0, 13);
}
