# Guest workshop checkout

Buyers do not need to sign in before buying a Workshop Ticket. Stripe Checkout collects their email. Signed-in checkout still passes the Course Builder user id.

## Identity and access

Course Builder core's `stripeCheckoutSessionComplete` handler reads the Stripe customer email and calls `findOrCreateUser(email)`. The existing inline fulfillment runner records the purchase for that user. CodeTV does not create a separate guest identity.

When the buyer later signs in through Clerk with the same email, `getCourseBuilderUserForClerkUser` finds that Course Builder user by email and stores the Clerk external id. The workshop's existing purchase lookup then shows that user's ticket.

The checkout route still rejects a signed-in ticket owner with `already-purchased`. A guest cannot be checked for ownership before Stripe collects their email. Guest checkout therefore does not prevent repeat purchases. Core's existing fulfillment rules still apply to those payments.

Coupon selection, opt-in PPP, quantity limits, enrollment windows and safe cancel URLs use the same server-side paths for both kinds of buyer. Browser-supplied user ids are discarded.

## After checkout

The purchase wait page works without a sign-in. It polls by Stripe checkout session id, not a browser-supplied email or user id. Once the purchase exists, it resolves the buyer email from that purchase's user. Treat the checkout session URL as private bearer proof; do not share it.

Signed-out buyers see their checkout email and a sign-in/create-account link. The sign-in page permits only a same-origin return URL and returns them to the workshop after either flow.

## Confirmation mail follow-up

The repository has Clerk authentication and Kit newsletter subscribe/tag helpers. It has no configured transactional purchase-mail sender or purchase-email implementation. The inline runner still logs `NEW_PURCHASE_CREATED_EVENT` without sending mail.

No provider or dependency was added. Before relying on guest checkout in production, decide whether to enable Stripe receipts or supply an approved transactional mail path. This change does not alter Stripe dashboard settings. A future purchase email should include the workshop title, November 9–13, 2026 (Pacific), an instruction to sign in with the checkout email, the workshop link and `info@codetv.dev`.

## Local behavior proof

Run `node --test src/coursebuilder/guest-checkout.test.ts` from `apps/website` with `CODETV_GUEST_TEST_MYSQL_URL` set to a **local disposable MySQL 8 admin URL**. Never use a production database URL. Without that variable, the integration test explicitly skips.

The test creates a uniquely named `codetv_guest_<timestamp>` schema, applies the checked-in migration and drops only that schema in cleanup. It exercises real core checkout/fulfillment, DrizzleAdapter, Clerk linking, ticket lookup, checkout ownership guards and session-scoped confirmation lookup. Stripe I/O and Astro's config loader are fixture boundaries. No Stripe charge occurs.

Deploy-preview acceptance remains a separate check: signed out, follow Buy to `checkout.stripe.com`, check the amount ($300 default; $250 with `?code=MEMBER-5E6D28`), and leave both sessions unpaid.
