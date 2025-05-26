import { v2, type TransformationOptions } from 'cloudinary';
import {
	CLOUDINARY_CLOUD_NAME,
	CLOUDINARY_API_KEY,
	CLOUDINARY_API_SECRET,
} from 'astro:env/server';

v2.config({
	cloud_name: CLOUDINARY_CLOUD_NAME,
	api_key: CLOUDINARY_API_KEY,
	api_secret: CLOUDINARY_API_SECRET,
});

export const cloudinary = v2;

export function createImageUrl(
	public_id: string,
	transformations: TransformationOptions = {},
) {
	const base_transformation: TransformationOptions = {
		quality: 'auto',
		format: 'auto',
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
