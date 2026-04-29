# Agent-readiness SOP

Use <https://isitagentready.com/> as the external smoke test for CodeTV and any CourseBuilder-powered app surface we ship.

Run this checklist whenever we add or change public API, auth, commerce, content, or discovery behavior. The goal is not “AI garnish.” The goal is boring, machine-usable affordances that let agents discover, authenticate, read, and operate without scraping soup like raccoons.

## Required checks

1. **Scan the site**
   - Run the site through `https://isitagentready.com/`.
   - Record failures or regressions in the relevant PR/issue/plan.
   - Do not treat the score as gospel; treat it as a blunt external smoke test.

2. **Discoverability**
   - `robots.txt` exists and points at sitemap(s).
   - sitemap(s) include canonical public content.
   - public API/discovery routes return stable JSON.
   - response headers/metadata do not hide important discovery surfaces.

3. **Agent protocol discovery**
   - CourseBuilder app discovery exists at `/.well-known/coursebuilder-app`.
   - API entrypoint exists at `/api` with `_links`, `capabilities`, and `next_actions`.
   - OAuth discovery exists where supported:
     - `/oauth/.well-known/openid-configuration`
   - Protected-resource/OAuth metadata should be added before expanding beyond local operator use.

4. **Content accessibility**
   - Public pages should have clean canonical HTML.
   - Where possible, expose structured JSON API equivalents instead of forcing agents to scrape pages.
   - Consider markdown content negotiation for article/workshop/lesson pages once the content model stabilizes.

5. **Bot access control**
   - Explicitly decide AI bot access in `robots.txt`.
   - Add Content Signals / Web Bot Auth only when we are ready to enforce them consistently.
   - Do not accidentally block the operator/CLI/API surface while trying to block crawler sludge.

6. **Operator API compatibility**
   - CourseBuilder CLI contract is the source of truth for content/support operations.
   - For every route added, smoke test with `cb` when the CLI exposes that route.
   - Keep responses JSON-first, small enough to inspect, and include useful error bodies.

7. **Commerce readiness**
   - Before product/ticket launch, verify checkout, product, price, availability, purchase, and enrollment routes are discoverable and agent-safe.
   - x402/MPP/UCP/ACP are future-facing checks; do not fake support. Advertise only what works.

## CodeTV current baseline

Implemented now:

- `/.well-known/coursebuilder-app`
- `/api`
- `/oauth/device/code`
- `/oauth/token`
- `/oauth/userinfo`
- `/oauth/register`
- `/oauth/.well-known/openid-configuration`
- `/api/resources`
- `/api/resources/edges`
- `/api/lessons`
- `/api/workshops`
- `/api/products`
- `/api/products/:productId/availability`
- `/api/products/:productId/enrollment`

Known gaps:

- `robots.txt` / sitemap / AI bot policy audit still needed.
- Markdown content negotiation not implemented.
- MCP Server Card / WebMCP / Agent Skills discovery not implemented.
- OAuth Protected Resource metadata not implemented.
- Agentic commerce protocols are not implemented and should not be advertised.

## Definition of done for new agent-facing surfaces

A surface is agent-ready enough to ship when:

- It is linked from a discovery document or intentionally private.
- It has stable JSON request/response behavior.
- Auth requirements are explicit.
- Errors are structured and actionable.
- It has at least one curl or CLI smoke test.
- `https://isitagentready.com/` has been run against the target environment and any relevant failures are documented.
