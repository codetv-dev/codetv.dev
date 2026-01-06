<?xml version="1.0" encoding="utf-8"?>
<xsl:stylesheet version="3.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <xsl:output method="html" version="1.0" encoding="UTF-8" indent="yes" />
  <xsl:template match="/">
    <xsl:variable name="title">
      <xsl:value-of select="/rss/channel/title" />
    </xsl:variable>
    <xsl:variable name="description">
      <xsl:value-of select="/rss/channel/description" />
    </xsl:variable>
    <xsl:variable name="link">
      <xsl:value-of select="/rss/channel/link" />
    </xsl:variable>

    <html xmlns="http://www.w3.org/1999/xhtml">
      <head>
        <title><xsl:value-of select="/rss/channel/title" /> RSS Feed</title>
        <meta charset="UTF-8" />
        <meta http-equiv="x-ua-compatible" content="IE=edge,chrome=1" />
        <meta name="viewport"
          content="width=device-width,minimum-scale=1,initial-scale=1,shrink-to-fit=no" />
        <style type="text/css">
          * {
          box-sizing: border-box;
          margin: 0;
          }

          :root {
          /* UPDATED COLOR PALETTE */
          --gray-000: #080217;
          --gray-100: #18151f;
          --gray-200: #26222e;
          --gray-600: #79777e;
          --gray-700: #b5b1be;
          --gray-800: #ede9f6;
          --gray-900: #fff;

          --orange: #f0b525;
          --blue: #647cf6;

          --black: var(--gray-000);
          --white: var(--gray-900);
          --bg: var(--gray-100);
          --text: var(--gray-700);
          --text-muted: var(--gray-600);
          --text-emphasized: var(--gray-800);
          --text-link: var(--blue);

          --font-family: system-ui, sans-serif;
          --font-family-heading: system-ui, sans-serif;

          --max-width: 1600px;

          color: var(--text);
          font-family: var(--font-family);
          line-height: 1.45;
          }

          body {
          background: var(--bg);
          margin: 0;
          }

          header,
          main {
          margin-inline: auto;
          inline-size: min(90dvi, 600px);
          }

          header {
          margin-block-start: 40px;
          }

          main {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-block: 80px;
          }

          article {
          background: var(--bg);
          container: article / inline-size;
          align-items: start;
          border: 1px solid transparent;
          border-radius: 3px;
          color: var(--text);
          display: flex;
          flex-direction: column;
          justify-content: stretch;
          padding: 20px 0;
          }

          :is(h1, h2, h3, h4, h5, h6) {
          color: var(--text-emphasized);
          font-family: var(--font-family-heading);
          font-weight: 600;
          font-variation-settings: 'wdth' 85;
          letter-spacing: -0.02em;
          line-height: 1.1;
          text-wrap: pretty;
          }

          h1 {
          font-family: var(--font-family-heading);
          font-size: clamp(1.5em, 5cqi, 2.5em);
          line-height: 0.9;
          }

          h2 {
          font-size: clamp(1.25em, 3.5cqi, 1.75em);
          }

          h3 {
          font-size: clamp(1.125em, 3cqi, 1.875em);
          }

          h3 a {
          color: var(--white);
          text-decoration: none;
          }

          h3 a:is(:focus, :hover, :active) {
          text-decoration: underline;
          }

          p {
          margin-block-start: 8px;
          }

          a {
          color: var(--blue);
          }

          :is(strong, b) {
          color: var(--text-emphasized);
          }
        </style>
      </head>
      <body>
        <header>
          <h1>
            <xsl:value-of select="/rss/channel/title" /> RSS Feed </h1>
          <p>
            <xsl:value-of select="/rss/channel/description" /> Produced by CodeTV. </p>
          <p>
            Subscribe to this RSS feed in your favorite feed reader.
          </p>
          <p>
            <a hreflang="en"
              target="_blank">
              <xsl:attribute name="href">
                <xsl:value-of select="/rss/channel/link" />
              </xsl:attribute> See the
              latest season of <xsl:value-of select="/rss/channel/title" /> &#x2192; </a>
          </p>
        </header>
        <main>
          <h2>Recent Episodes</h2>
          <xsl:for-each select="/rss/channel/item">
            <article>
              <h3>
                <a hreflang="en" target="_blank">
                  <xsl:attribute name="href">
                    <xsl:value-of select="link" />
                  </xsl:attribute>
                  <xsl:value-of select="title" />
                </a>
              </h3>
              <p>
                <xsl:apply-templates select="description" />
              </p>
              <p>

                <a hreflang="en" target="_blank">
                  <xsl:attribute name="href">
                    <xsl:value-of select="link" />
                  </xsl:attribute> Watch full
                  episode &#x2192;</a>
              </p>
            </article>
          </xsl:for-each>
        </main>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>