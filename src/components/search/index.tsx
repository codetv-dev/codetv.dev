import { getAlgoliaResults } from '@algolia/autocomplete-preset-algolia';
import { useState } from 'react';

import { searchClient } from './search-client';
import { LinkItem, QueryEpisodeItem } from './items.jsx';
import { SupportIcon } from './icons/support-icon.jsx';
import { YouTubeLogo } from './logos/youtube-logo.jsx';
import { SearchIcon } from './icons/search-icon.tsx';
import { NewsletterIcon } from './icons/newsletter-icon.jsx';
import { Autocomplete } from './autocomplete.jsx';

type AlgoliaItem = {
	item: {
		url: string;
		slug: {
			current: string;
		};
	};
};

export function SearchBox({
	open,
	onToggle = () => window.location.assign('/'),
}: {
	open: boolean;
	onToggle?: () => void;
}) {
	return (
		<Autocomplete
			placeholder="Search for episodes and posts"
			openOnFocus={true}
			autoFocus={true}
			defaultActiveItemId={0}
			isOpen={open}
			onToggle={onToggle}
			initialState={{
				query: new URL(window.location.toString()).searchParams.get('q') ?? '',
			}}
			emptyQuery={() => [
				{
					sourceId: 'links',
					getItems: () => [
						{
							label: 'Become a CodeTV supporter',
							description: 'Help us make more tv for developers!',
							url: '/support',
							icon: () => (
								<div className="aa-LinkPicture">
									<SupportIcon />
								</div>
							),
						},
						{
							label: 'Subscribe to the newsletter',
							description: 'The best way to make sure you don’t miss anything.',
							url: '/newsletter',
							icon: () => (
								<div className="aa-LinkPicture">
									<NewsletterIcon />
								</div>
							),
						},
					],
					getItemUrl: ({ item }: AlgoliaItem) => item.url,
					templates: {
						header: () => <div className="aa-Header">Links</div>,
						item: ({ item }: AlgoliaItem) => <LinkItem item={item} />,
					},
				},
			]}
			sources={() => [
				{
					sourceId: 'episodes',
					getItemUrl({ item }: AlgoliaItem) {
						return item.url;
					},
					getItems({ query, ...rest }: { query: any }) {
						return getAlgoliaResults({
							searchClient,
							queries: [
								{
									indexName: 'codetv_dev_yzf8n5ikfx_episodes',
									query,
									params: {
										hitsPerPage: 12,
									},
								},
								{
									indexName: 'codetv_dev_yzf8n5ikfx_articles',
									query,
									params: {
										hitsPerPage: 12,
									},
								},
								{
									indexName: 'codetv_dev_yzf8n5ikfx_pages',
									query,
									params: {
										hitsPerPage: 12,
									},
								},
							],
						});
					},
					templates: {
						item: ({ item }: AlgoliaItem) => <QueryEpisodeItem item={item} />,
					},
				},
			]}
			noResults={({ query }: { query: any }) => (
				<div className="aa-NoResults">
					<div className="aa-NoResultsLabel">No results for "{query}".</div>
				</div>
			)}
		/>
	);
}

export function Search() {
	const [searchState, setSearchState] = useState<'open' | 'closed'>('closed');

	return (
		<>
			<button
				className="aa-OpenButton"
				data-name="main-search"
				onClick={() => setSearchState('open')}
			>
				<SearchIcon />
				<span className="aa-OpenButtonText" data-viewport="large">
					search the site
				</span>
				<span className="aa-OpenButtonText" data-viewport="small">
					search
				</span>
				<span className="sr-only">Open search</span>
			</button>
			<SearchBox
				open={searchState === 'open'}
				onToggle={() =>
					setSearchState(searchState === 'open' ? 'closed' : 'open')
				}
			/>
		</>
	);
}
