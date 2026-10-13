import assert from 'node:assert/strict';
import { it } from 'node:test';
import { getWorkshopSeo, renderWorkshopBody } from './workshop-page.ts';

it('renders introduction, h2 sections and an inline FAQ with Markdown formatting', () => {
	const sections = renderWorkshopBody(
		'Intro **text**.\n\n## Learn\n\n- One\n- Two\n\n### Details\n\nMore.\n\n## FAQ\n\n**When?** Soon.',
	);
	assert.equal(sections.length, 3);
	assert.match(sections[0].bodyHtml, /<strong>text<\/strong>/);
	assert.equal(sections[0].headingHtml, '');
	assert.equal(sections[1].headingHtml, 'Learn');
	assert.match(sections[1].bodyHtml, /<ul>\n<li>One<\/li>/);
	assert.match(sections[1].bodyHtml, /<h3>Details<\/h3>/);
	assert.equal(sections[2].headingHtml, 'FAQ');
	assert.match(sections[2].bodyHtml, /<strong>When\?<\/strong> Soon/);
});

it('keeps code and nested headings in their section and resolves reference links', () => {
	const sections = renderWorkshopBody(
		'## First\n\n```md\n## Not a section\n```\n\n> ## Quoted heading\n\n[Read][docs]\n\n## Second\n\n[docs]: https://example.com/docs',
	);
	assert.equal(sections.length, 2);
	assert.match(sections[0].bodyHtml, /<code>## Not a section/);
	assert.match(sections[0].bodyHtml, /<blockquote>/);
	assert.match(sections[0].bodyHtml, /href="https:\/\/example.com\/docs"/);
});

it('sanitizes headings, raw HTML, event handlers and unsafe link schemes', () => {
	const sections = renderWorkshopBody(
		'## Safe <img src=x onerror="alert(1)">\n\n<script>alert(1)</script>\n\n<iframe src="https://evil.example"></iframe>\n\n<a href="javascript:alert(1)" onclick="alert(1)">Bad</a>\n\n[Unsafe](javascript:alert)\n\n[Safe](https://example.com)',
	);
	const html = sections
		.map((section) => section.headingHtml + section.bodyHtml)
		.join('');
	assert.doesNotMatch(html, /script|iframe|onerror|onclick|javascript:|<img/);
	assert.match(html, /Safe /);
	assert.match(html, /href="https:\/\/example.com"/);
});

it('handles empty bodies and consecutive headings', () => {
	assert.deepEqual(renderWorkshopBody(null), []);
	assert.deepEqual(renderWorkshopBody(' \n\t'), []);
	assert.equal(renderWorkshopBody('## One\n\n## Two').length, 2);
});

it('uses SEO overrides independently and falls back for missing or blank fields', () => {
	const workshop = {
		title: 'Sample',
		description: 'Description',
		seoTitle: null,
		seoDescription: null,
	};
	assert.deepEqual(getWorkshopSeo(workshop), {
		title: 'Sample | CodeTV Workshop',
		description: 'Description',
	});
	assert.deepEqual(
		getWorkshopSeo({
			...workshop,
			seoTitle: 'SEO title',
			seoDescription: 'SEO description',
		}),
		{ title: 'SEO title', description: 'SEO description' },
	);
	assert.deepEqual(getWorkshopSeo({ ...workshop, seoTitle: 'SEO title' }), {
		title: 'SEO title',
		description: 'Description',
	});
	assert.deepEqual(
		getWorkshopSeo({
			...workshop,
			seoTitle: ' ',
			seoDescription: '',
			description: null,
		}),
		{ title: 'Sample | CodeTV Workshop', description: undefined },
	);
});
