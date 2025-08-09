# CodeTV Monorepo

Various web apps and libs supporting [CodeTV](https://codetv.dev).

## Current web apps

- Website (`apps/website/`) — [codetv.dev](https://codetv.dev)
- Workflows (`apps/workflows/`) — automations and backend functionality
- Content (`apps/content/`) — Sanity CMS for managing site content

## Running these projects

To run them all at once (requires all env vars):

```sh
# from the repo root
pnpm run dev
```

To run a single app:

```sh
# starts the website in dev mode
pnpm nx run @codetv/website:dev
```

