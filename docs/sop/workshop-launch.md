# SOP: Launch a Workshop Cohort and sell Workshop Tickets

This is the runbook for selling the first CodeTV **Workshop** **Cohort** on codetv.dev through CourseBuilder and Stripe Checkout. It covers env vars, the Stripe webhook, creating the Workshop, Cohort and **Workshop Ticket** with the CourseBuilder CLI (`cb`), and a test-mode purchase on a Netlify deploy preview.

Use the domain words from `CONTEXT.md`: Workshop, Cohort, Workshop Ticket, Purchase Processing, Workshop Access.

## What ships in this slice

- `/workshops/{workshopSlug}`: the Workshop page with Cohort dates and a pricing block for the current Workshop Ticket.
- Pricing through CourseBuilder `prices-formatted`: the early bird default coupon, a `?code=` coupon, and opt-in PPP (regional pricing).
- Enrollment window: `open`, `not-yet-open` or `closed`, from the product's `openEnrollment` / `closeEnrollment`. When there is no `closeEnrollment`, sales close at the Cohort start (day one).
- Sign-in before checkout (Clerk). Signed-in Viewers go to Stripe Checkout.
- Stripe webhook at `/api/coursebuilder/webhook/stripe` records the purchase in the CodeTV CourseBuilder database. Workshop Access is purchase-based: a `Valid` or `Restricted` (PPP) individual purchase of the ticket product.
- `/thanks/purchase`: the Purchase Processing screen. It polls until the purchase is verified, then shows the welcome state. After about 2 minutes it shows the "payment succeeded, setup delayed" message.
- Operator procedures for `cb`: `commerce.seedMerchantCoupons`, `commerce.createCohort`, `commerce.createCoupon` and `commerce.listPurchases`.

Not in this slice: team seats and `/dashboard/team`, Ticket Transfer, the CodeTV Invoice page, purchase emails, Discord role grant and Kit sync. The code has TODOs that name the AI Hero files to port.

## How fulfillment works

CourseBuilder core's webhook does not write purchases itself. It sends `stripe/checkout-session-completed` to an Inngest client, and core's `stripeCheckoutSessionComplete` function writes `MerchantCharge`, `MerchantSession` and `Purchase`. CodeTV's Inngest app (`apps/workflows`) can't reach the CourseBuilder database, so `src/coursebuilder/fulfillment.ts` runs that same core handler inside the webhook request.

- If fulfillment fails, the webhook returns non-2xx and Stripe retries (for up to 3 days).
- A retried delivery is safe: core creates one purchase per Stripe charge.
- Logs to search in Netlify function logs: `stripe.webhook.checkout.session.completed`, `purchase.flow.started`, `commerce.fulfillment.step`, `purchase.completed`, `commerce.fulfillment.completed`, `purchase-processing.poll`, and `purchase-processing.gave-up` (a buyer saw the delayed-setup message).

## Safety guards in `/api/coursebuilder/*`

CodeTV owns this route (`src/pages/api/coursebuilder/[...coursebuilder].ts`; the integration runs with `injectEndpoints: false`). It works around these `@coursebuilder/core` 1.2.1 problems:

| Core 1.2.1 behavior                                                                                                                                                   | CodeTV guard                                                                                                                                                                                              |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Webhook signature is skipped when the `stripe-signature` header is missing, and the async check is not awaited when it is present.                                    | The route verifies the raw body with the Stripe SDK first. Missing or bad signature: `400`.                                                                                                               |
| `refund`, `transfer`, `lookup` and `create-magic-link` compare `x-skill-secret` to `SKILL_SECRET`. When `SKILL_SECRET` is unset, a request without the header passes. | These actions return `401` unless `SKILL_SECRET` is set and matches.                                                                                                                                      |
| Checkout mints a Stripe promotion code from any `couponId` it receives and auto-applies PPP from the query country.                                                   | The browser sends only `usedCouponId` (from `?code=`) and a `ppp=1` opt-in. The server picks the merchant coupon and pins the country to `US` unless PPP was chosen and the geolocated country qualifies. |
| Checkout trusts `userId`, `quantity` and `country` from the query string.                                                                                             | The server sets them from the Clerk session, `1`, and Netlify geolocation.                                                                                                                                |

## Environment variables (Netlify, `apps/website` site)

Set these per deploy context in Netlify: **Deploy previews** use Stripe **test** keys, **Production** uses live keys.

| Variable                              | Required | Notes                                                                                                                                                             |
| ------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                        | yes      | CodeTV CourseBuilder database (PlanetScale). Already set for the CLI routes.                                                                                      |
| `COURSEBUILDER_STRIPE_SECRET_TOKEN`   | yes      | Stripe secret key for the CourseBuilder account. Test key (`sk_test_...`) on deploy previews.                                                                     |
| `COURSEBUILDER_STRIPE_WEBHOOK_SECRET` | yes      | Signing secret (`whsec_...`) of the webhook endpoint below. Each Stripe endpoint has its own secret.                                                              |
| `COURSEBUILDER_STRIPE_ACCOUNT_ID`     | optional | `acct_...`, stored on the `ctv_MerchantAccount` row.                                                                                                              |
| `COURSEBUILDER_URL`                   | optional | Set it **only in the production context** (`https://codetv.dev`). Leave it unset for deploy previews: Stripe success and cancel URLs then use `DEPLOY_PRIME_URL`. |
| `SKILL_SECRET`                        | optional | Enables core's support actions (`refund`, `transfer`, `lookup`, `create-magic-link`). Leave it unset to keep them disabled.                                       |
| `DEFAULT_COUNTRY`                     | optional | Fallback country when Netlify has no geolocation. Defaults to `US`.                                                                                               |

The `COURSEBUILDER_STRIPE_*` vars override `STRIPE_*` for CourseBuilder only. Jason's membership checkout keeps using `STRIPE_*`.

Clerk must work on the deploy preview's domain or nobody can sign in to buy. Check which Clerk instance deploy previews use before the test purchase.

## Stripe webhook

In the Stripe dashboard (test mode for a preview), add an endpoint:

- URL: `https://<deploy-host>/api/coursebuilder/webhook/stripe`. For production, use the canonical host (`https://codetv.dev/...`, or `www` if that is canonical).
- Events, minimum: `checkout.session.completed`, `charge.refunded`, `charge.dispute.created`.
- Events, full set core handles: add `customer.subscription.updated`, `invoice.payment_succeeded`, `charge.succeeded`, `charge.dispute.funds_withdrawn`, `customer.updated`, `customer.subscription.created`, `customer.subscription.deleted`, `checkout.session.async_payment_failed` and `checkout.session.async_payment_succeeded`.
- Copy the endpoint's signing secret into `COURSEBUILDER_STRIPE_WEBHOOK_SECRET` for that deploy context and redeploy.

Locally, forward events with the Stripe CLI and use the secret it prints:

```sh
stripe listen --forward-to localhost:4321/api/coursebuilder/webhook/stripe
```

## Operator setup with `cb`

The operator must be a CourseBuilder user with `role = 'admin'` in `ctv_User`. Commands below use `$APP_URL` for the deployment you're setting up, for example a deploy preview.

```sh
export APP_URL=https://deploy-preview-<pr-number>--<site-name>.netlify.app
cb auth login --app codetv --base-url "$APP_URL"
cb auth whoami --app codetv --base-url "$APP_URL"
```

### 1. Seed merchant coupons (once per Stripe account)

PPP and percentage coupons only work when Stripe-backed `MerchantCoupon` rows exist: `ppp` at 40–75% in 5% steps, and `special` at 10, 25, 40, 50, 60, 75, 90 and 95%. This is idempotent. It refuses a live Stripe key unless you pass `"allowLive": true`.

```sh
cb trpc post commerce.seedMerchantCoupons --app codetv --base-url "$APP_URL" --body '{"dryRun":true}'
cb trpc post commerce.seedMerchantCoupons --app codetv --base-url "$APP_URL" --body '{}'
```

### 2. Create and publish the Workshop

```sh
cb crud workshop create --app codetv --base-url "$APP_URL" \
  --title "Example Workshop" \
  --description "One-line description of the workshop." \
  --structure '[]'

# Use the workshop id from the response.
cb resource update <workshopId> --app codetv --base-url "$APP_URL" \
  --body '{"fields":{"slug":"example-workshop","state":"published","visibility":"unlisted"}}'
```

`unlisted` works by URL and is enough to sell. Use `public` once it should be listed.

### 3. Create the Cohort and Workshop Ticket

This creates a `cohort` resource linked to the Workshop, plus a published `cohort`-type product priced in USD. Sales close at `startsAt` (day one). `openEnrollment` and `earlyBird` are optional. The early bird is a default coupon, so it applies automatically until it expires.

Day one at midnight Pacific is `08:00Z` in winter (PST) and `07:00Z` in summer (PDT).

```sh
cb trpc post commerce.createCohort --app codetv --base-url "$APP_URL" --body '{
  "workshopId": "<workshopId>",
  "title": "Example Workshop: Cohort 1",
  "startsAt": "2026-11-09T08:00:00.000Z",
  "endsAt": "2026-11-14T08:00:00.000Z",
  "price": 100,
  "openEnrollment": "2026-10-20T07:00:00.000Z",
  "earlyBird": { "percentageDiscount": 0.25, "expires": "2026-10-27T07:00:00.000Z" }
}'
```

Check `earlyBird.created` in the response. If it is `false`, step 1 didn't run against this Stripe account.

To change the window later, use the product id from the response:

```sh
curl -X PUT "$APP_URL/api/products" \
  -H "Authorization: Bearer <cb token>" -H "Content-Type: application/json" \
  -d '{"id":"<productId>","closeEnrollment":"2026-11-09T08:00:00.000Z"}'
```

`cb product update <productId> --state draft` takes the ticket off sale immediately.

### 4. Coupon codes

`createCoupon` snaps the discount to the nearest seeded `special` percentage. The response includes a share URL (`/workshops/<slug>?code=<code>`).

```sh
cb trpc post commerce.createCoupon --app codetv --base-url "$APP_URL" --body '{
  "productId": "<productId>",
  "percentageDiscount": 0.1,
  "code": "EXAMPLE10",
  "label": "Example coupon"
}'
```

### 5. Verify the product

```sh
cb crud product list --slug-or-id <productId> --app codetv --base-url "$APP_URL"
```

`merchantVerification.verified` must be `true`: the Stripe product and price exist and are active.

## Test purchase on a deploy preview (Stripe test mode)

1. Open `$APP_URL/workshops/example-workshop`. Check the title, Cohort dates, price, "Sales close …" line, and the early bird discount if one is active.
2. Open `$APP_URL/workshops/example-workshop?code=EXAMPLE10` and check the coupon price.
3. Signed out, click **Sign in to buy**, sign in, and check that you land back on the same URL with the code.
4. Click **Buy a ticket**. Stripe Checkout opens in test mode with the discount applied.
5. Pay with `4242 4242 4242 4242`, any future expiry, any CVC.
6. You land on `$APP_URL/thanks/purchase?session_id=cs_test_...`. It shows "Finalizing your ticket…", then "You're in!" with a link back to the Workshop.
7. Reload the Workshop page: it shows "You have a ticket for this cohort." A second checkout attempt bounces back with "You already have a ticket".
8. List buyers:

   ```sh
   # input = {"productId":"<productId>"}, URL-encoded
   cb trpc get commerce.listPurchases --app codetv --base-url "$APP_URL" \
     --query 'input=%7B%22productId%22%3A%22<productId>%22%7D'
   cb crud product enrollment <productId> --app codetv --base-url "$APP_URL"
   ```

9. In Stripe (test), check the webhook endpoint's delivery for `checkout.session.completed` returned `200`.
10. Optional: refund the test payment in Stripe. The `charge.refunded` webhook sets the purchase to `Refunded`, and the Workshop page offers a ticket again.

PPP can't be faked on Netlify because the country comes from Netlify geolocation. Test it through a VPN in a PPP country. Locally, `astro dev` accepts `?ppp_country=IN` on the Workshop page.

## Checks

```sh
pnpm --filter @codetv/website test            # node --test: enrollment, polling, coupons, redirects, fulfillment
pnpm --filter @codetv/website exec astro check # 11 errors exist on main; this change adds none
pnpm --filter @codetv/website exec astro build
```

## Rollback

- Before merge: close the PR.
- After merge: `cb product update <productId> --state draft` stops sales. Removing the CourseBuilder Stripe env vars disables CourseBuilder checkout and webhooks without touching Jason's membership checkout.
