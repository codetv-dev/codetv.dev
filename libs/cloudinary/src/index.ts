import { type ImageTransformationOptions, v2 } from 'cloudinary';

export type { UploadApiResponse } from 'cloudinary';

const cloud_name = process.env.CLOUDINARY_CLOUD_NAME ?? 'jlengstorf';
const api_key = process.env.CLOUDINARY_API_KEY;
const api_secret = process.env.CLOUDINARY_API_SECRET;

if (!cloud_name || !api_key || !api_secret) {
	console.error(
		'Must provide Cloudinary env vars. See .env.TEMPLATE for details.',
	);
}

v2.config({
	cloud_name,
	api_key,
	api_secret,
});

export const cloudinary = v2;

export function createImageUrl(
	public_id: string,
	transformations: ImageTransformationOptions = {},
) {
	const base_transformation: ImageTransformationOptions = {
		quality: 'auto',
		format: transformations.format ?? 'auto',
	};

	const url = cloudinary.url(public_id, {
		transformation: [base_transformation, transformations],
	});

	return url;
}

export function getYouTubeThumbnail(youtube_id: string) {
	return cloudinary.url(youtube_id, { type: 'youtube' });
}

export function generateDefaultImage({ text }: { text: string }) {
	const url = cloudinary.url('codetv/codetv-blog-default-dark', {
		transformation: [
			{
				quality: 'auto',
				format: 'auto',
			},
			{
				width: 1600,
				aspect_ratio: '16:9',
				crop: 'fill',
			},
			{
				overlay: {
					font_family: 'ctv-font%2Eotf',
					font_size: 135,
					line_spacing: -35,
					text: text,
				},
				crop: 'fit',
				color: 'white',
				height: 465,
				width: 1472,
			},
			{ flags: 'layer_apply', gravity: 'south_west', x: 64, y: 195 },
		],
	});

	return url;
}

export function getImageURLWithFallback({
	src,
	public_id,
	youtube_id,
	text = '',
	width = 675,
	aspect_ratio = {
		w: 340,
		h: 190,
	},
}: {
	src?: string | null;
	public_id?: string | null;
	youtube_id?: string | null;
	text?: string;
	width?: number;
	aspect_ratio?: {
		w: number;
		h: number;
	};
}) {
	let imageURL;
	if (src) {
		imageURL = src;
	} else if (public_id) {
		imageURL = createImageUrl(public_id, {
			width,
			aspect_ratio: `${aspect_ratio.w}:${aspect_ratio.h}`,
			crop: 'fill',
		});
	} else if (youtube_id) {
		imageURL = getYouTubeThumbnail(youtube_id);
	} else {
		imageURL = generateDefaultImage({ text });
	}

	return imageURL;
}
