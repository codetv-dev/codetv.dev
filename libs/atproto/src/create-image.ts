import { createBlobFromImageUrl } from './index.ts';

console.log(
	JSON.stringify(
		await createBlobFromImageUrl(
			'https://res.cloudinary.com/jlengstorf/image/upload/v1782357991/the-full-stack-series_1.jpg',
		),
		null,
		2,
	),
);
