---
name: coursebuilder-cli-operator
description: Use when integrating, debugging, or smoke-testing CourseBuilder CLI/operator API surfaces in apps such as CodeTV, AI Hero, or Code with Antonio. Triggers on CourseBuilder CLI, `cb` commands, `/api/resources`, `/api/workshops`, `/api/products`, device auth, CourseBuilder Stripe checkout/webhooks, or matching app routes to `packages/aihero-cli/src/cli.ts`.
---

# CourseBuilder CLI/operator integration

Use the CourseBuilder CLI as the contract. Do not invent app API behavior when the CLI or AIH/CWA already defines it.

## Source order

1. `@coursebuilder/core` for `/api/coursebuilder/*` commerce behavior.
2. `/Users/joel/Code/badass-courses/course-builder/packages/aihero-cli/src/cli.ts` for CLI route/shape contract.
3. AI Hero and Code with Antonio route implementations for proven app patterns:
   - `/Users/joel/Code/badass-courses/course-builder/apps/ai-hero/src/app/api`
   - `/Users/joel/Code/badass-courses/course-builder/apps/code-with-antonio/src/app/api`
   - `/Users/joel/Code/badass-courses/course-builder/apps/*/src/app/oauth`

If sources conflict, support what the CLI calls and prefer the working app implementation unless core has a newer verified-compatible behavior.

## Common CLI smoke commands

Run from the CourseBuilder repo:

```bash
cd /Users/joel/Code/badass-courses/course-builder
npx pnpm@10.26.1 --filter @coursebuilder/cli dev -- auth whoami --app codetv
npx pnpm@10.26.1 --filter @coursebuilder/cli dev -- resource get <slug-or-id> --app codetv
npx pnpm@10.26.1 --filter @coursebuilder/cli dev -- crud lesson list --app codetv --slug-or-id <id>
npx pnpm@10.26.1 --filter @coursebuilder/cli dev -- crud workshop create --app codetv --title 'Smoke' --structure '[{"type":"lesson","title":"Intro"}]'
npx pnpm@10.26.1 --filter @coursebuilder/cli dev -- crud product list --app codetv --slug-or-id <id>
```

CLI top-level CRUD commands are usually under `crud`, not direct aliases:

- `cb crud lesson ...`
- `cb crud workshop ...`
- `cb crud product ...`

Generic resources are top-level:

- `cb resource create|get|update ...`

## CodeTV integration notes

- CodeTV keeps Clerk for viewer auth.
- CourseBuilder DB tables use `ctv_` prefix.
- `ctv_User.fields.externalId` stores the Clerk user ID; generated `ctv_User.externalId` indexes it.
- Operator API bearer tokens live in `ctv_DeviceAccessToken`.
- CourseBuilder Stripe can use app-specific env vars:
  - `COURSEBUILDER_STRIPE_SECRET_TOKEN`
  - `COURSEBUILDER_STRIPE_WEBHOOK_SECRET`
  - `COURSEBUILDER_STRIPE_ACCOUNT_ID`
- CourseBuilder Stripe webhook URL shape:
  - `/api/coursebuilder/webhook/stripe`

## Route parity checklist

For each route:

1. Check `packages/aihero-cli/src/cli.ts` for exact path, method, query params, and body shape.
2. Check AIH/CWA route implementation.
3. Port/adapt to the target app runtime.
4. Use bearer-token `getUserAbilityForRequest` for operator routes.
5. Return JSON errors with useful status codes.
6. Smoke test through `cb` if the CLI exposes it; otherwise use curl.
7. Clean smoke DB rows.
8. Update local context/plans and discovery documents if the route is public.

## Stripe webhook events currently handled by core

Endpoint: `/api/coursebuilder/webhook/stripe`

Workflow/status-changing events:

- `checkout.session.completed`
- `customer.subscription.updated`
- `invoice.payment_succeeded`
- `charge.refunded`
- `charge.dispute.created`

Logged/accepted events:

- `charge.dispute.funds_withdrawn`
- `charge.succeeded`
- `customer.updated`
- `customer.subscription.created`
- `customer.subscription.deleted`
- `checkout.session.async_payment_failed`
- `checkout.session.async_payment_succeeded`
