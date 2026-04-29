# CourseBuilder → CodeTV API Surface Plan

## Source order

1. `@coursebuilder/core` defines `/api/coursebuilder/*` commerce behavior.
2. `packages/aihero-cli/src/cli.ts` defines the CLI/API contract CodeTV must satisfy.
3. `apps/ai-hero` and `apps/code-with-antonio` show the working implementation patterns to mirror.
4. If sources conflict, support what `aihero-cli` calls and prefer AIH/CWA working patterns unless `@coursebuilder/core` has a newer verified-compatible API.

## Implementation phases

1. CourseBuilder schema/config/catchall route. — started: packages installed, Astro integration wired, schema/db/config scaffolded.
2. Device auth, CASL ability helpers, `getUserAbilityForRequest`, and `withSkill`. — started: OAuth device-flow routes, discovery metadata, activation page, tRPC verification procedure, minimal ability helper, and `withSkill` wrapper added.
3. CLI discovery and tRPC fetch-adapter route. — started: `/.well-known/coursebuilder-app`, `/api/trpc/*` fetch adapter route, health procedure, and `deviceVerification.verify` scaffolded.
4. Core content CRUD: resources, edges, workshops, lessons, products. — started: public `/api` entrypoint, CLI-compatible `/api/resources` GET/POST/PUT, `/api/resources/edges` GET/POST/PATCH/DELETE, and `/api/lessons` GET/PUT smoke-tested.
5. Pricing, checkout, Workshop Ticket purchase, and team claim flows.
6. Upload/media routes needed by creator/import workflows.
7. Support, search, memory, shortlinks, surveys, and remaining operator surfaces.

The target is full CLI/API parity, but each phase should ship with smoke tests before moving to the next surface.

## CodeTV target routes

### Core CourseBuilder commerce

| Target                                                             | Source                                         | Status   | Notes                                                                                                        |
| ------------------------------------------------------------------ | ---------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------ |
| `apps/website/src/pages/api/coursebuilder/[...coursebuilder].ts`   | `@coursebuilder/astro`, core `CourseBuilder()` | required | Reserve `/api/coursebuilder/*` for checkout, webhook, redeem, pricing, purchases, support-protected actions. |
| `POST /api/coursebuilder/checkout/stripe`                          | core                                           | required | Workshop Ticket checkout. Product types `cohort` and `live` matter for verify-login behavior.                |
| `POST /api/coursebuilder/prices-formatted`                         | core                                           | required | Pricing component depends on PPP/coupons/team price formatting.                                              |
| `POST /api/coursebuilder/redeem` or `/redeem/coupon` compatibility | core + commerce-next usage                     | required | Team seat claim path posts coupon redemption. Verify exact core path naming while porting.                   |
| `POST /api/coursebuilder/webhook/stripe`                           | core                                           | required | Stripe purchase/webhook handling for CourseBuilder purchases.                                                |
| `GET /api/coursebuilder/purchases?userId=...`                      | core                                           | required | Self purchase/access lookup.                                                                                 |

## tRPC

| Target                                         | Source             | Status   | Notes                                                                                   |
| ---------------------------------------------- | ------------------ | -------- | --------------------------------------------------------------------------------------- |
| `apps/website/src/pages/api/trpc/[...trpc].ts` | tRPC fetch adapter | required | Use `fetchRequestHandler({ endpoint: '/api/trpc' })`.                                   |
| arbitrary `GET/POST /api/trpc/:procedure`      | `aihero-cli trpc`  | required | CLI accepts arbitrary procedure names. Pricing data loader procedures should live here. |

## CLI/device auth

Mirror CWA/AIH device-flow routes and DB tables.

| Target                                        | Source                            | Status   | Notes                                             |
| --------------------------------------------- | --------------------------------- | -------- | ------------------------------------------------- |
| `GET /.well-known/coursebuilder-app`          | `aihero-cli` discovery            | started  | Enables CLI app profile discovery.                |
| `POST /oauth/device/code`                     | CWA/AIH                           | started  | Starts device flow.                               |
| `POST /oauth/token`                           | CWA/AIH                           | started  | CLI polls for bearer token.                       |
| `GET /oauth/userinfo`                         | CWA/AIH                           | started  | CLI `whoami`.                                     |
| `POST /oauth/register`                        | CWA/AIH                           | started  | Match existing app behavior unless proven unused. |
| `GET /oauth/.well-known/openid-configuration` | CWA/AIH                           | started  | Discovery metadata.                               |
| device verification UI/API                    | CWA/AIH tRPC `deviceVerification` | started  | `/activate` page calls `deviceVerification.verify`. |

Auth pattern: port `getUserAbilityForRequest` and `withSkill`; adapt internals only where Clerk forces it. Clerk is not the design driver.

## Content CRUD API surface

CLI effectively defines this contract. CodeTV should expose the full surface needed for agent/operator content ops.

| Target                                                | Source implementation | Status                        | Notes                                                                                    |
| ----------------------------------------------------- | --------------------- | ----------------------------- | ---------------------------------------------------------------------------------------- |
| `GET/POST/PUT/DELETE /api/resources`                  | CWA strongest         | started                       | GET/POST/PUT implemented and smoke-tested through CLI; DELETE still pending.              |
| `GET/POST/PATCH/DELETE /api/resources/edges`          | CWA                   | started                       | Parent/child resource linking implemented and curl-smoke-tested.                         |
| `POST /api/resources/revalidate`                      | CWA                   | useful                        | Explicit cache/revalidation route.                                                       |
| `GET/POST /api/workshops`                             | CWA                   | required                      | Workshop create/list/get. Supports structure and pricing fields.                         |
| `GET/PUT /api/lessons`                                | CWA/AIH               | started                       | Lesson list/get/update implemented and CLI-smoke-tested.                                 |
| `GET/POST/PUT/DELETE /api/lessons/:lessonId/solution` | CWA/AIH               | defer unless CLI launch needs | Lesson solution CRUD.                                                                    |
| `GET /api/products`                                   | AIH                   | required                      | Product list/get with nested structure.                                                  |
| `GET /api/products/:productId/availability`           | CWA better            | required for team/quantity    | Use CWA version because it excludes refunded purchases.                                  |
| `GET /api/products/:productId/enrollment`             | AIH                   | required for team reporting   | Bulk seat/enrollment stats.                                                              |
| `GET/POST/PUT/DELETE /api/posts`                      | CWA/AIH               | defer                         | Not needed for first Workshop sale unless CLI requires broad content parity immediately. |
| `GET/POST/PATCH/DELETE /api/surveys`                  | CWA/AIH               | defer                         | Support later CLI parity.                                                                |
| `GET/POST/DELETE /api/shortlinks`                     | CLI                   | defer                         | Support/marketing ops later.                                                             |
| `GET /api/search`                                     | AIH                   | useful                        | Agent discovery/search.                                                                  |
| `GET/POST /api/memory`                                | AIH                   | useful                        | Agent support memory.                                                                    |

## Upload/media API surface

| Target                                           | Source  | Status                                 | Notes                                           |
| ------------------------------------------------ | ------- | -------------------------------------- | ----------------------------------------------- |
| `/api/uploads/new`                               | CWA/AIH | required if CLI imports/uploads videos | Used by `cb creator upload` and Dropbox import. |
| `/api/uploads/signed-url`                        | CWA/AIH | required for uploads                   | Single-part helper.                             |
| `/api/uploads/multipart/create`                  | CLI     | required for large uploads             | Multipart upload start.                         |
| `/api/uploads/multipart/part-url`                | CLI     | required for large uploads             | Signed part URLs.                               |
| `/api/uploads/multipart/complete`                | CLI     | required for large uploads             | Complete multipart.                             |
| `GET /api/videos/:videoResourceId` or equivalent | CWA     | useful                                 | Video resource lookup.                          |
| `GET /api/thumbnails`                            | CLI     | defer                                  | Thumbnail generation/metadata.                  |

## Team seats

| Target                                         | Source                          | Status   | Notes                                                        |
| ---------------------------------------------- | ------------------------------- | -------- | ------------------------------------------------------------ |
| `/dashboard/team`                              | AIH team page pattern           | required | Team buyers copy claim links, self-claim, see claimed seats. |
| `?code=<bulkCouponId>` on Workshop/Cohort page | commerce-next `getInviteLink`   | required | Team Claim Link lands on relevant page.                      |
| claim confirmation modal                       | existing pricing/coupon pattern | required | Do not invent new safeguards; mirror existing claim modal.   |
| coupon redemption endpoint                     | `commerce-next` + core          | required | Claim creates purchase/access from bulk coupon.              |

## Workshop URL surface

| Target                                   | Status       | Notes                                                     |
| ---------------------------------------- | ------------ | --------------------------------------------------------- |
| `/workshops/{workshopSlug}`              | required     | Sales/content page for Workshop and active Cohort ticket. |
| `/workshops/{workshopSlug}/{lessonSlug}` | required     | Normal workshop lesson URL shape.                         |
| cohort-specific material namespace       | out of scope | Add only when needed.                                     |

## Implementation notes

- CodeTV CourseBuilder DB is standalone; do not share records with AIH/CWA.
- Workshop/Cohort content lives in CourseBuilder DB, not Sanity.
- Existing supporter memberships/archive access are out of scope for first sale path.
- Use CourseBuilder CLI/scripts to create and maintain Workshop/Cohort/Ticket records, not a new admin UI.
- Pricing component + data loader are part of the serious commerce path because they encode PPP, coupons, discounts, team pricing, and scaled discounts.
- Validate whether `createCohort` CLI support exists; adapter supports it, but CLI inventory surfaced `workshop create` more clearly than `cohort create`.
- Watch product type: `createWorkshop` creates `self-paced`; Cohort product creation creates `cohort`; events create `live`. Workshop Ticket semantics likely need Cohort product behavior.
