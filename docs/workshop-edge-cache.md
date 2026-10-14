# Workshop shell caching

Workshop pages render the default US price and guest checkout form in the shared shell. The pricing widget still refines coupon and regional offers through the existing pricing action. Ticket ownership loads through a private server island. An owner response hides the guest buying controls and shows the existing ticket status. Checkout continues to enforce purchase and enrollment rules on the server.

## Cache policy

- The shell stays fresh for 60 seconds. Netlify may serve it stale for up to 86,400 more seconds while refreshing it in the background.
- The entire fresh-plus-stale window ends **before** the default coupon expires or enrollment opens/closes. A five-second margin prevents a response generated near a boundary from crossing it. Near a boundary, the page uses `no-store`.
- A failed default-price lookup is not cached.
- A new deploy invalidates the cache automatically. We do not set `Netlify-Cache-ID`, which would opt out of that invalidation. This also prevents an old shell from calling an island with a new deploy's encryption key.
- The first request to an empty cache after a deploy still invokes SSR. Later edge or durable hits avoid that invocation. A long idle period within the stale window does not force visitors to wait for SSR.

## Anonymous versus private requests

The uncached `workshop-cache-key` edge function runs before the shell cache lookup. It overwrites `x-codetv-workshop-session` with an anonymous/session decision. It removes `code` from the forwarded URL and overwrites `x-codetv-workshop-query` with a SHA-256 fingerprint of the remaining query string. Clients cannot supply either trusted key.

Session evidence means an Authorization header, a `__session` or `__session_<suffix>` cookie, or any `__client_uat*` cookie whose value is not `0`. Analytics cookies and zero UAT values stay on the anonymous cache entry.

The origin checks that decision again after Clerk runs. Authenticated responses, session evidence, responses setting cookies, and non-200 responses are not shared. The ownership island always uses `private, no-store`.

The cache varies only on those two trusted headers, not country or coupon code. Every visitor sees the same default US price in initial HTML. The client always calls the existing pricing action in the background; the server reads the trusted country and returns any regional offer. The default price stays visible while that request loads. No regional amount or account state enters the shared shell. Coupon links share the base shell. The browser reads its original `?code=`, resolves it through the private pricing action, and preserves the validated coupon in checkout plus the original code in the cancel URL. Unknown or expired codes leave the default offer unchanged.

## Purge after content or price edits

Purge affected workshop tags after changing content, a price, a coupon, or enrollment settings outside a deploy. Do not rely on the stale window for those edits.

Each shell carries these tags:

- `workshop:<resource-id>`: stable even if the slug changes.
- `workshop:<slug>`: convenient for an existing public workshop URL.

For this page, the slug tag is `workshop:agentic-frontend-engineering`. Use a Netlify token with permission to purge the site. Keep the token out of source control.

```sh
curl --fail-with-body --request POST \
  'https://api.netlify.com/api/v1/purge' \
  --header "Authorization: Bearer ${NETLIFY_AUTH_TOKEN}" \
  --header 'Content-Type: application/json' \
  --data '{"site_slug":"codetv","cache_tags":["workshop:agentic-frontend-engineering"]}'
```

That request purges the tag across the site's deploys. Add `"deploy_alias":"deploy-preview-93"` to the JSON to target that preview instead. When a product or coupon affects several workshops, purge each affected workshop tag. When renaming a workshop, use its resource-ID tag or both old and new slug tags.

After purging, the first request fills the cache. Confirm subsequent requests show `Netlify Edge; hit` or `Netlify Durable; hit`. A synthetic session-cookie request must show a miss/bypass and `Cache-Control: private, no-store`. Never verify cache behavior by assuming an origin `no-store` can undo a cache lookup that has already happened.

## Rollback

Revert this PR and deploy. Atomic deployment invalidates its cached shells. No checkout, price, coupon or Stripe mutation is needed for rollback.

Reference: [Netlify caching and tag purges](https://docs.netlify.com/build/caching/caching-overview/).
