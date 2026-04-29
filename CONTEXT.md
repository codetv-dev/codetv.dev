# CodeTV Commerce

CodeTV Commerce defines how CodeTV sells paid learning experiences while keeping existing supporter memberships and archive access separate until explicitly migrated.

## Language

**Viewer**:
A person authenticated through CodeTV who may buy Workshop Tickets and receive Workshop Access.
_Avoid_: user, account, customer

**Operator**:
An internal admin user who can authenticate CLI/API tools for content and support operations.
_Avoid_: admin, staff user

**Workshop**:
A paid learning experience whose content structure remains the same across live delivery, recording access, and archive access.
_Avoid_: event, product, self-paced workshop

**Cohort**:
A ticketed, scheduled live delivery of a Workshop that grants attendees access to the Workshop during and after the live period.
_Avoid_: event, workshop run

**Workshop Ticket**:
A purchasable pass to a specific Cohort that grants live-period benefits and lifetime access to that Cohort's Workshop recordings and materials.
_Avoid_: event purchase, product

**Workshop Access**:
A person's ability to view a Workshop or Cohort-specific materials through a Workshop Ticket, team seat claim, or supporter membership.
_Avoid_: entitlement, permission, grant

**Cohort Materials**:
Recordings, Q&A, office hours, and resources produced for a specific Cohort rather than the shared Workshop.
_Avoid_: replay, assets, bonus content

**Team Seat**:
A claimed seat from a team Workshop Ticket purchase that grants Workshop Access to an additional Viewer.
_Avoid_: license, invite, transfer

**Team Claim Link**:
A URL from a team Workshop Ticket purchase that lets another Viewer claim a Team Seat.
_Avoid_: coupon link, invite link, transfer link

**Workshop Archive**:
The collection of past Workshops available through supporter membership rather than an individual Workshop Ticket.
_Avoid_: self-paced workshop, previous event, replay product

## Relationships

- A **Workshop** may have one or more **Cohorts** over time.
- A **Cohort** belongs to exactly one **Workshop**.
- Multiple **Cohorts** may grant access to the same **Workshop** unless the content materially forks into a new **Workshop**.
- **Cohort Materials** may remain scoped to the **Cohort** attended rather than becoming shared **Workshop** material.
- A **Workshop Ticket** belongs to exactly one **Cohort** and creates lifetime **Workshop Access** for that Cohort's **Workshop**.
- A **Workshop Ticket** may create additional lifetime **Workshop Access** to Cohort-specific materials for the attended **Cohort**.
- A **Workshop Ticket** may include live-period benefits that expire after the **Cohort** ends.
- A team **Workshop Ticket** purchase creates claimable **Team Seats** using a **Team Claim Link** associated with a coupon code.
- A **Team Claim Link** should land on the relevant **Cohort** or **Workshop** page with the existing claim confirmation modal pattern before the seat is claimed.
- A supporter membership may create **Workshop Access** to the **Workshop Archive** after a **Workshop** is no longer in its live ticketed access period.
- **Workshop Archive** availability may lag behind the live run to preserve **Workshop Ticket** value.
- Existing supporter memberships and archive access are separate from **Workshop Ticket** sales until the membership model is intentionally migrated.
- Team buyers manage claim links, seat claims, and remaining seats from `/dashboard/team`.
- Workshop pages use workshop-first URLs such as `/workshops/{workshopSlug}`; lesson pages may live beneath the workshop at `/workshops/{workshopSlug}/{lessonSlug}`.
- Cohort-specific material URL namespaces are out of scope for the first implementation.
- One Clerk-authenticated **Viewer** maps to one CourseBuilder user through the Clerk user ID stored as an external identifier.
- A CourseBuilder user row is created lazily when a **Viewer** first performs an authenticated commerce interaction.
- **Viewer** auth uses Clerk for the first commerce integration.
- **Operator** auth may use Auth.js for CourseBuilder CLI/device-flow authentication while CodeTV evaluates a longer-term Clerk migration.
- The first CodeTV commerce path may require sign-in before checkout, even though other CourseBuilder apps can create a user from the Stripe checkout email and offer post-purchase transfer.
- CodeTV owns its own CourseBuilder database and does not share Workshop, product, purchase, access, or Workshop content records with other CourseBuilder apps.
- Workshop and Cohort commerce content lives in the CodeTV CourseBuilder database, not Sanity.
- Initial Workshop, Cohort, and Ticket records should be created and maintained with the existing CourseBuilder CLI or scripts rather than a new admin UI.
- CodeTV should validate CLI workflows for creating, listing, and updating commerce content so CRUD UI is not required for the first implementation.
- CodeTV should target full CLI/API parity for the CourseBuilder CLI; the CLI effectively defines the content and support operations contract.
- Primary sources for the CodeTV integration are `@coursebuilder/core` for the `/api/coursebuilder/*` routes, `aihero-cli` for the CLI contract, and AI Hero / Code with Antonio for implemented real-world route patterns.
- When sources conflict, support what `aihero-cli` calls and prefer AI Hero / Code with Antonio working patterns over abstract package intent, unless `@coursebuilder/core` has a newer verified-compatible API.
- CodeTV should mirror the Code with Antonio and AI Hero device-flow OAuth/token patterns so agents and operators can perform authenticated content CRUD and support operations.
- CASL abilities remain the generalized RBAC model; CodeTV should mirror the existing CourseBuilder API route authorization patterns rather than inventing a divergent auth split.
- CodeTV should port the existing `getUserAbilityForRequest` and `withSkill` patterns, adapting internals only where Clerk forces it.
- Clerk is a transitional complication, not a design driver.
- Routes should resolve the acting principal once per request through shared helpers rather than directly mixing Clerk, Auth.js, device token, and CourseBuilder user lookup logic.
- The first CourseBuilder integration sells individual **Workshop Tickets** and grants lifetime **Workshop Access** for purchased **Workshops**.
- Code with Antonio and AI Hero are reference implementations; CodeTV should keep the first Astro integration simple while reusing or adapting the existing React pricing component and pricing data loader because they present PPP, coupons, discounts, team pricing, and scaled discounts.

## Example dialogue

> **Dev:** "Does a Cohort become a different content type after the live period ends?"
> **Domain expert:** "No. The **Cohort** is the ticketed live delivery. The content remains a **Workshop**. The access path changes from a **Workshop Ticket** to supporter membership **Workshop Access** through the **Workshop Archive**."

## Flagged ambiguities

- "Event" and "workshop run" were used for the ticketed live delivery — resolved: the customer-facing domain term is **Cohort**.
- "Self-paced Workshop" was considered for post-live access — rejected: the content resource remains a **Workshop**; only the entitlement source changes.
- "Entitlement" names a CourseBuilder schema concept, not a CodeTV domain term — resolved: use **Workshop Access** in domain language.
- The exact lag before a **Workshop** enters the **Workshop Archive** is intentionally unresolved; likely around 15 days, but supporter tier rules are not yet decided.
- Supporter membership and archive access rules are deferred; the first implementation focuses on selling live **Workshop Tickets**.
- CodeTV may offer products similar to other CourseBuilder apps, but those products are modeled as standalone CodeTV **Workshops**; for example, **Building Cool Apps with AI** is a CodeTV **Workshop**, while AI Hero is a separate product.
- Guest checkout and post-purchase transfer exist in other CourseBuilder apps but are not required for the first CodeTV commerce path.
- Team ticket purchases are in scope for CodeTV because team seats are claimed through a **Team Claim Link** associated with a coupon code.
- Existing CourseBuilder team seat patterns should be reused rather than inventing new team purchase mechanics.
- Do not overbuild unlikely account-mismatch safeguards for team seat claims; follow the proven existing claim flow.
- The React pricing component and pricing data loader are part of the first serious commerce path because they present PPP, coupons, discounts, team pricing, and scaled discounts that should not be casually reimplemented.
- CodeTV should expose tRPC from Astro at `/api/trpc` using `@trpc/server/adapters/fetch` so the existing pricing data loader path can be brought over with minimal transport changes.
- CodeTV must reserve `/api/coursebuilder/*` for CourseBuilder commerce endpoints and `/api/trpc/*` for app pricing/data procedures.

## Current implementation milestone — CourseBuilder foundation PR

Branch: `coursebuilder-integration`

Recent commits in this milestone:

- `6f59b22` — Integrate CourseBuilder schema and device auth
- `d1fefe4` — Add CourseBuilder resource API smoke slice
- `5d8a460` — Add CourseBuilder resource edges API
- `552574d` — Add CourseBuilder lessons API
- `83cb3f9` — Add CourseBuilder workshops API
- `a2f8457` — Add CourseBuilder products API
- `622f3f4` — Ensure Stripe merchant account for workshop products
- `a33dd50` — Support CourseBuilder-specific Stripe env
- `b5d8d7c` — Add agent-readiness SOP

### What is implemented

CourseBuilder is integrated into CodeTV as a standalone CourseBuilder database surface using the `ctv_` table prefix. CodeTV still uses Clerk for viewer authentication. CourseBuilder users are bridged by storing the Clerk user ID in `ctv_User.fields.externalId`, surfaced through generated `ctv_User.externalId`.

Implemented CourseBuilder/Astro foundation:

- `apps/website/coursebuilder.config.ts`
- `apps/website/drizzle.config.ts`
- `apps/website/src/db/*`
- `apps/website/src/coursebuilder/*`
- `@coursebuilder/astro` wired in `apps/website/astro.config.mjs`
- `/api/coursebuilder/*` injected by the CourseBuilder Astro integration
- `/api/trpc/*` fetch-adapter route with `deviceVerification.verify`

Implemented CLI/operator auth and discovery:

- `/.well-known/coursebuilder-app`
- `/api`
- `/oauth/device/code`
- `/oauth/token`
- `/oauth/userinfo`
- `/oauth/register`
- `/oauth/.well-known/openid-configuration`
- `/activate`
- minimal `getUserAbilityForRequest`
- minimal `withSkill`

Implemented CLI-compatible operator API slices:

- `/api/resources` — `GET`, `POST`, `PUT`
- `/api/resources/edges` — `GET`, `POST`, `PATCH`, `DELETE`
- `/api/lessons` — `GET`, `PUT`
- `/api/workshops` — `GET`, `POST`
- `/api/products` — `GET`
- `/api/products/:productId/availability` — `GET`
- `/api/products/:productId/enrollment` — `GET`

Implemented CourseBuilder-specific Stripe env isolation:

- `COURSEBUILDER_STRIPE_SECRET_TOKEN`
- `COURSEBUILDER_STRIPE_SECRET_KEY`
- `COURSEBUILDER_STRIPE_WEBHOOK_SECRET`
- `COURSEBUILDER_STRIPE_ACCOUNT_ID`

These override generic `STRIPE_*` vars only for CourseBuilder commerce. This matters because CodeTV has an existing Stripe account for memberships/supporters and CourseBuilder may use a separate Stripe account.

CourseBuilder Stripe webhook URL for production:

```txt
https://codetv.dev/api/coursebuilder/webhook/stripe
```

If production canonical URL is `www.codetv.dev`, use:

```txt
https://www.codetv.dev/api/coursebuilder/webhook/stripe
```

CourseBuilder core currently handles these Stripe events:

- workflow/status-changing: `checkout.session.completed`, `customer.subscription.updated`, `invoice.payment_succeeded`, `charge.refunded`, `charge.dispute.created`
- logged/accepted: `charge.dispute.funds_withdrawn`, `charge.succeeded`, `customer.updated`, `customer.subscription.created`, `customer.subscription.deleted`, `checkout.session.async_payment_failed`, `checkout.session.async_payment_succeeded`

Recommended Stripe webhook event set for CourseBuilder prod: use the full supported set above. Minimum for Workshop Ticket one-time checkout is `checkout.session.completed`, plus `charge.refunded` and `charge.dispute.created` for post-purchase status changes.

### Validated smoke tests

Validated with the actual CourseBuilder CLI from `/Users/joel/Code/badass-courses/course-builder/packages/aihero-cli/src/cli.ts` using `npx pnpm@10.26.1 --filter @coursebuilder/cli dev -- ...`.

Smoke-tested successfully:

- `cb auth whoami --app codetv`
- `cb auth login --app codetv --no-poll`
- `cb resource create/get/update --app codetv`
- `cb crud lesson list/update --app codetv`
- `cb crud workshop create/get/list --app codetv`
- `cb crud workshop create --create-product --price 1 --app codetv`
- `cb crud product list/availability/enrollment --app codetv`
- curl-based `/api/resources/edges` create/list/patch/delete

Temporary smoke rows were cleaned from the DB after tests.

### Known caveats / open items

- `astro check` still fails with 8 unrelated pre-existing CodeTV errors. CourseBuilder/db/API files were filtered and did not introduce new check errors.
- The actual paid checkout flow has not been end-to-end verified in prod.
- Stripe webhook delivery has not been end-to-end verified in prod.
- Purchase/access rows after checkout are not yet verified.
- `/api/coursebuilder/prices-formatted`, `/api/coursebuilder/checkout/stripe`, purchases lookup, redeem/team claim paths still need focused verification.
- `DELETE /api/resources` is not implemented yet.
- Upload/media routes are not implemented yet.
- Search/memory/support/shortlink/survey parity routes are deferred.
- `cb app current` for unknown `codetv` profile may not hydrate capability flags from discovery; auth and endpoint calls still work.
- `workshop create --create-product` creates CourseBuilder `self-paced` products today. Workshop Ticket / Cohort semantics may need a `cohort` or `live` product flow later.

### Next steps

Recommended PR framing now: **CourseBuilder foundation + CLI/operator API surface**, not commerce-complete.

After opening the PR, continue with follow-up work in this order:

1. Verify CourseBuilder core commerce endpoints locally/prod:
   - `POST /api/coursebuilder/prices-formatted`
   - `POST /api/coursebuilder/checkout/stripe`
   - `GET /api/coursebuilder/purchases?userId=...`
   - `POST /api/coursebuilder/redeem` or exact coupon redeem path used by CourseBuilder core
2. Run a real Stripe checkout in prod using the CourseBuilder Stripe account.
3. Confirm Stripe webhook delivery to `/api/coursebuilder/webhook/stripe`.
4. Confirm rows land in:
   - `ctv_MerchantEvent`
   - `ctv_MerchantSession`
   - `ctv_MerchantCharge`
   - `ctv_Purchase`
5. Verify access lookup for the purchasing Clerk viewer bridged to `ctv_User.externalId`.
6. Port/team-verify Team Seat / Team Claim Link flow.
7. Add upload/media routes if Workshop import/upload workflow needs CLI support.
8. Update agent-readiness artifacts as public surfaces stabilize:
   - `robots.txt`
   - sitemap audit
   - `llms.txt`
   - OAuth Protected Resource metadata

### Agent-readiness SOP

Added `docs/sop/agent-readiness.md` and adopted <https://isitagentready.com/> as an external smoke test. Treat it as a checkpoint, not the critical path. Continue CourseBuilder commerce flows first and update discovery/SOP artifacts as surfaces become real.
