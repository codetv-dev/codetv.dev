import { cloudinary } from '@codetv/cloudinary';
import { inngest } from '../../client.js';

export const imageUpload = inngest.createFunction(
	{
		id: 'cloudinary/image.upload',
		description:
			'Uploads a given user avatar URL to Cloudinary. If the image already exists it does not re-upload.',
	},
	{ event: 'cloudinary/image.upload' },
	async function ({ event }) {
		return cloudinary.uploader.upload(event.data.imageUrl, {
			public_id:
				event.data.username +
				'-' +
				new URL(event.data.imageUrl).pathname.split('/').at(1),
			folder: 'codetv/people',
			overwrite: false,
		});
	},
);
