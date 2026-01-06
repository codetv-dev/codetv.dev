import rss from '@astrojs/rss';
import { getAllEpisodes, getAllSeries, getSeriesBySlug } from '@codetv/sanity';
import type { APIRoute } from 'astro';

export const prerender = true;

export async function getStaticPaths() {
	const allSeries = await getAllSeries();

	return allSeries.flatMap((s) => {
		return {
			params: {
				seriesSlug: s.slug,
			},
		};
	});
}

export const GET: APIRoute = async (context) => {
	if (!context.site) {
		throw new Error('Setting a `site` in astro.config.mjs is required for RSS');
	}

	const slug = context.params.seriesSlug;
	if (!slug) {
		return new Response('Not Found', { status: 404 });
	}

	const allEpisodes = await getAllEpisodes();
	const episodes = allEpisodes.filter((ep) => ep.series?.slug === slug);
	const series = await getSeriesBySlug({
		series: slug,
		collection: episodes.at(0)?.collection?.slug!,
	});

	const items = episodes
		.sort(
			(a, b) =>
				new Date(b.publish_date).valueOf() - new Date(a.publish_date).valueOf(),
		)
		.map((ep) => {
			return {
				title: `${ep.title} · ${series?.title} ${ep.collection?.title}`,
				pubDate: new Date(ep.publish_date),
				description: ep.short_description,
				link: `/series/${ep.series?.slug}/${ep.collection?.slug}/${ep.slug}`,
			};
		});

	const site = context.site;
	site.pathname = `/series/${series?.slug}/${series?.collection?.slug}/`;

	return rss({
		title: series?.title ?? '',
		description: series?.description ?? '',
		site,
		stylesheet: '/rss-series.xsl',
		items,
	});
};
