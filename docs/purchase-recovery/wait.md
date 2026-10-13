# Post-purchase wait

This ports the waiting behavior from AI Hero #394 and its `docs/purchase-wait/README.md`, without Next.js navigation or authentication changes. The CodeTV thank-you page renders immediately. Stripe and database lookups happen inside the bounded React check, not before the shell renders.

## Lifecycle

The state-machine sketch is `checking.waiting -> checking.polling -> checking.waiting`, then `ready` or `failed`. `failed` means checking stopped, not payment failed. Retry creates a fresh checking lifecycle. A dependency-free interpreter implements these states so the site does not need XState just for this island.

- One section and heading remain mounted through processing, slow, support and completion.
- Independent timers show slow copy at 10 seconds and support at 90 seconds. They do not depend on a fetch returning.
- The deadline and unmount abort the active request, cancel timers and ignore late responses. Retry resets the deadline, request signal and polling attempts.
- A database or transport miss does not prove payment failed. Payment-confirmed copy requires a verified purchase or Stripe `payment_status=paid` evidence.
- The support state has a Check again button and a mailto link to `info@codetv.dev`, with the checkout reference in the draft email.
- A polite live region announces changed status. Completion and support focus the heading (`tabIndex=-1`). Waiting uses static content, with no looping spinner. Reduced motion disables animations and transitions.
- A verified ticket retains the workshop link and regional-pricing explanation. No checkout, pricing, Stripe or fulfillment behavior changes.

`purchase-processing.poll` and `purchase-processing.gave-up` remain. The UI also records `purchase-processing.slow` and `purchase-processing.support-shown`. Observation requests return immediately without doing another commerce lookup, so a stalled provider cannot delay the logs. The best-effort observation request has its own five-second bound.

## Verification

Node tests exercise the exact 10s/90s boundaries, a never-resolving request, cancellation, fresh retry deadlines, late results, transport errors, JSON validation, and static React shell copy/support links. The combined website suite has 72 passing tests. `astro check` retains main's 11 existing errors.

A mounted Chromium check with synthetic fixtures and an accelerated clock proved the same section remains mounted, slow/live-region copy appears at 10s, a hung request reaches support and aborts at 90s, retry uses a new signal, the prior response cannot complete the retry, and ready/support headings receive focus. The reduced-motion frame had zero active animations and the 390px mobile viewport had no horizontal overflow. This is component behavior proof, not a paid-checkout or entitlement test.

## Release and rollback

Merge the alert-only reconciler (#88) first, then the waiting flow (#89). The waiting branch includes the reconciler commit, but targets main so Netlify produces a website deploy preview. Review the waiting-flow commit separately until #88 merges; the inherited reconciler file diff then disappears. Netlify deploys the thank-you page with the website. There is no feature flag. Restore the previous website deploy to roll back the UI. The reconciler stays alert-only and can remain deployed independently.
