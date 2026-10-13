# Paid checkout reconciliation

The `reconcile-paid-checkouts` Netlify scheduled function runs hourly (`0 * * * *`) on the published production deploy. It is always alert-only. It never calls fulfillment or writes purchases.

## Detection

The function uses `COURSEBUILDER_STRIPE_SECRET_TOKEN` and `DATABASE_URL`. It enumerates charges paid within the last 48 hours, then lists completed Checkout Sessions for each payment intent. Both lists paginate. Stripe's Checkout Session list filters by session creation, not payment time. Starting with charges also catches sessions opened before the window but paid inside it.

Only completed, paid, payment-mode sessions with a nonblank `metadata.productId` count. CourseBuilder core 1.2.1 stamps that marker in `src/lib/pricing/stripe-checkout.ts`. Refunds, including partial refunds, and payments younger than 10 minutes are skipped. Age comes from the paid charge's `created` timestamp, never the session's creation.

Purchases match through either `ctv_MerchantSession.identifier` or `ctv_MerchantCharge.identifier`, joined to `ctv_Purchase`. These are the same joins used by the CourseBuilder adapter. Read-only parameterized queries avoid loading the commerce adapter's unavailable CommonJS entrypoint in the scheduled function. No dependencies were added.

Each missing purchase produces one JSON log line per hourly sweep:

```json
{"event":"commerce.reconcile.missing","sessionId":"cs_test_example","productId":"workshop-ticket","ageSeconds":600}
```

Set the optional `RECONCILE_ALERT_WEBHOOK_URL` in Netlify's production function environment to notify an operator through a Slack or Discord incoming webhook. Treat the URL as a secret; do not commit it. Each missing checkout sends one JSON POST with identical `text` and `content` fields:

```json
{"text":"CodeTV paid checkout with no ticket: session cs_test_example, product workshop-ticket, paid 10 min ago","content":"CodeTV paid checkout with no ticket: session cs_test_example, product workshop-ticket, paid 10 min ago"}
```

The request uses plain fetch with a five-second timeout. Network errors, timeouts and non-2xx responses log `commerce.reconcile.alert-failed` without throwing, so the sweep still finishes and subsequent missing checkouts are checked and alerted. Failure logs never include the webhook URL, response body or provider error message. Without a webhook URL, alerts remain log-only. `RECONCILE_ALERT_EMAIL` is no longer used; the site has no transactional mail sender.

`commerce.reconcile.complete` includes `missingCount`. Stripe and database errors fail the sweep and log `commerce.reconcile.failed`; lookup failures never become missing-purchase alerts. There is no persistent deduplication: an unresolved checkout alerts again next hour until it leaves the window or gains a purchase.

## Release and rollback

Merge the reconciler PR first. Netlify discovers the function under `apps/website/netlify/functions`. Scheduled functions do not run automatically on deploy previews. Confirm the schedule and a successful production sweep in Netlify. Remove the function or restore the preceding deploy to stop it. No auto-fulfill flag exists.

## Checks

Node fixture tests cover the CourseBuilder marker, payment mode, paid/completed state, payment age boundaries, partial/full refunds, both purchase identity paths, async enumeration, database failures, the Slack/Discord payload and five-second timeout, optional URL behavior, and webhook failures not breaking the sweep. The function's CommonJS bundle imports with Node's ESM `require()` support disabled. `astro check` retains main's 11 pre-existing errors.
