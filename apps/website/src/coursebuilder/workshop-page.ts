import { marked, type Token, type TokensList } from 'marked';
import sanitizeHtml from 'sanitize-html';

export type WorkshopBodySection = {
	headingHtml: string;
	bodyHtml: string;
};

/** Split only top-level Markdown h2 tokens, not headings inside code or quotes. */
export function renderWorkshopBody(body: string | null): WorkshopBodySection[] {
	if (!body?.trim()) return [];

	const tokens = marked.lexer(body);
	const sections: WorkshopBodySection[] = [];
	let headingHtml = '';
	let content: Token[] = [];
	const render = (items: Token[]) =>
		sanitizeHtml(
			marked.parser(
				Object.assign([...items], { links: tokens.links }) as TokensList,
			),
		);
	const flush = () => {
		const bodyHtml = render(content);
		if (headingHtml || bodyHtml.trim())
			sections.push({ headingHtml, bodyHtml });
	};

	for (const token of tokens) {
		if (token.type === 'heading' && token.depth === 2) {
			flush();
			headingHtml = sanitizeHtml(
				marked.Parser.parseInline(token.tokens ?? []),
				{
					allowedTags: ['em', 'strong', 'code', 'a', 's'],
				},
			);
			content = [];
		} else {
			content.push(token);
		}
	}
	flush();
	return sections;
}

export function getWorkshopSeo(workshop: {
	title: string;
	description: string | null;
	seoTitle: string | null;
	seoDescription: string | null;
}) {
	return {
		title: workshop.seoTitle?.trim() || `${workshop.title} | CodeTV Workshop`,
		description:
			workshop.seoDescription?.trim() || workshop.description || undefined,
	};
}
