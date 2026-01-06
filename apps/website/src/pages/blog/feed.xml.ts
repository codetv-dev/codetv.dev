import rss, { type RSSFeedItem } from '@astrojs/rss';
import type { AstroConfig } from 'astro';
import { getCollection } from 'astro:content';
import sanitizeHtml from 'sanitize-html';
/**
 * Have you ever found yourself doing something that repulses you to the very
 * core of your being? Something so gross that you’re worried if other people
 * knew about it they’d never look at you the same way again?
 *
 * Yeah, this file is one of those things.
 */

import type { CollectionEntry } from 'astro:content';
import type { Plugin } from 'esbuild';
import { basename, dirname, resolve } from 'node:path';
import { renderToString } from 'react-dom/server';
import { createElement } from 'react';
import { getMDXComponent } from 'mdx-bundler/client';
import { bundleMDX } from 'mdx-bundler';

export const prerender = true;

const loadAstroAsJsx = {
	name: 'loadAstroAsJsx',
	setup(build: any) {
		build.onLoad({ filter: /(\.astro|\.tsx)$/ }, async (args: any) => {
			let contents;

			switch (basename(args.path)) {
				case 'aside.astro':
					contents = `export default function Aside({ children }) { return <aside>{children}</aside>; }`;
					break;

				case 'codepen.astro':
					contents =
						'export default function CodePen({ slug, title }) { return <p>CodePen: <a href={`https://codepen.io/jlengstorf/pen/${slug}`}>{title}</a></p>; }';
					break;

				case 'figure.astro':
					contents =
						'export default function Figure({ children }) { return <figure>{children}</figure>; }';
					break;

				case 'youtube.astro':
					contents =
						'export default function YouTube({ children, id }) { return <p><a href={`https://youtu.be/${id}`}>Watch on YouTube</a></p>; }';
					break;

				case 'opt-in-form.astro':
					contents = `export default function OptInForm() { return <p><a href="https://lwj.dev/newsletter">Subscribe to my newsletter for more like this!</a></p>; }`;
					break;

				case 'mux-video-player.astro':
					contents = `export default function MuxVideoPlayer() { return <></>; }`;
					break;

				default:
					contents = `export default function Unknown() { return <></> }`;
			}

			return {
				contents,
				loader: 'jsx',
			};
		});
	},
};

async function getHtmlFromContentCollectionEntry(
	post: CollectionEntry<'blog'>,
) {
	if (!post.body) {
		return '';
	}

	console.log({
		path: resolve('./src/content/blog'),
		dirname: dirname(post.id),
		id: post.id,
		test: 'colocated',
	});

	const result = await bundleMDX({
		source: post.body,
		esbuildOptions(options) {
			options.plugins = [loadAstroAsJsx, ...(options.plugins as Plugin[])];

			return options;
		},
		cwd: resolve('./src/content/blog'),
	});

	const Component = await getMDXComponent(result.code);

	return renderToString(createElement(Component));
}

export async function GET(context: AstroConfig) {
	const blog = await getCollection(
		'blog',
		(entry) => entry.data.draft !== true,
	);

	if (!context.site) {
		throw new Error('Setting a `site` in astro.config.mjs is required for RSS');
	}

	const items = await Promise.all(
		blog
			.sort(
				(a, b) =>
					new Date(b.data.pubDate).valueOf() -
					new Date(a.data.pubDate).valueOf(),
			)
			.map(async (post) => {
				try {
					const img = post.data.share?.image ?? false;

					if (!post.body) {
						return;
					}

					const result = await bundleMDX({
						source: post.body,
						esbuildOptions(options) {
							options.plugins = [
								loadAstroAsJsx,
								...(options.plugins as Plugin[]),
							];

							return options;
						},
						cwd: resolve('./src/content/blog', dirname(post.id)),
					});

					const Component = await getMDXComponent(result.code);

					let html = '';

					// if a sharing image was set, put it at the top of the post
					if (img) {
						html += `<p><img src="${img}" alt="${post.data.title}" /></p>`;
					}

					html += renderToString(createElement(Component));

					const item = {
						title: post.data.title,
						pubDate: post.data.pubDate,
						description: post.data.description,
						link: `/blog/${post.id}`,
						content: sanitizeHtml(html, {
							// images are stripped by default
							allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
						}),
					};

					return item as RSSFeedItem;
				} catch (err) {
					console.error({ post, err });
				}
			}) as RSSFeedItem[],
	);

	return rss({
		title: 'CodeTV Blog RSS Feed',
		description:
			'Articles and tutorials about web dev, career growth, and more.',
		site: context.site,
		stylesheet: '/rss-blog.xsl',
		items,
	});
}
