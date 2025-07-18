/** @type {import("prettier").Config} */
export default {
	singleQuote: true,
	jsxSingleQuote: false,
	tabWidth: 2,
	useTabs: true,
	plugins: ['prettier-plugin-astro'],
	overrides: [
		{
			files: '*.astro',
			options: {
				parser: 'astro',
			},
		},
	],
};
