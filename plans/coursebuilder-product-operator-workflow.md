# Plan: CourseBuilder Product Operator Workflow

> Source PRD: GitHub issue #66 — Add CourseBuilder Product create/update operator workflow

## Architectural decisions

Durable decisions that apply across all phases:

- **Routes**: use the existing operator products route: `GET /api/products?slugOrId=...`, `POST /api/products`, and `PUT /api/products`.
- **CLI surface**: expose top-level product commands: `cb product create --name ... --price ... --app codetv` and `cb product update <product-id> --name ... --price ... --app codetv`.
- **Price semantics**: API and CLI prices are USD dollars with at most two decimal places. Stripe cents exist only at the Stripe provider boundary.
- **Authentication and authorization**: use existing operator authentication and existing content abilities: create permission for product creation and update permission for product updates.
- **Deep module**: product mutation, merchant verification, and cleanup behavior live in a reusable CourseBuilder product service. HTTP routes stay thin and only own auth, validation, response status, and JSON formatting.
- **Key models**: CourseBuilder Product, Price, MerchantProduct, and MerchantPrice.
- **Merchant verification**: successful mutations return the Product plus a merchant verification summary for the active Stripe product and price linkage.
- **Failure behavior**: product mutations fail hard when merchant verification fails. Cleanup is best-effort and uses soft-delete/archive behavior rather than hard deletion.
- **Public/private boundary**: merchant verification details are operator-only. Public reads should not expose Stripe IDs or merchant wiring if the read surface changes later.
- **Schema**: no database schema changes are expected for this feature.
- **Future extraction**: this remains app-local for CodeTV now, but should be considered for upstream CourseBuilder standardization after the workflow is validated.

---

## Phase 1: Create a verified no-resource Product through the API

**User stories**: 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 27, 28, 31, 34

### What to build

Implement the narrowest complete product creation path for operators. An authenticated operator can call `POST /api/products` with a product name and USD price. The system creates a no-resource CourseBuilder Product, creates the active local price, syncs the Stripe product and Stripe price, creates local merchant linkage, verifies that linkage, and returns the product plus merchant verification summary.

### Acceptance criteria

- [ ] `POST /api/products` accepts a minimal payload with product name and USD price.
- [ ] Price input uses USD dollars and accepts up to two decimal places.
- [ ] Price input with more than two decimal places is rejected with a clear validation error.
- [ ] New products default to the agreed minimal smoke shape: one-time product, unlimited quantity, draft, unlisted, no linked resources.
- [ ] Unauthorized requests fail.
- [ ] Operators without create permission fail.
- [ ] Successful creation returns the CourseBuilder Product.
- [ ] Successful creation returns merchant verification including provider, Stripe product identifier, Stripe price identifier, and verified status.
- [ ] Successful creation creates active local Product, Price, MerchantProduct, and MerchantPrice records.
- [ ] Successful creation creates active Stripe Product and Stripe Price records.
- [ ] A mutation does not return success unless merchant linkage is verified.

---

## Phase 2: Add product create CLI command

**User stories**: 2, 25, 26, 29

### What to build

Expose the product creation API through a top-level operator CLI command. The CLI accepts the same minimal operator language as the API, sends the request to CodeTV, and prints structured output containing the product and merchant verification summary.

### Acceptance criteria

- [ ] `cb product create --name <name> --price <usd> --app codetv` sends `POST /api/products`.
- [ ] CLI price input uses the same USD dollar semantics as the API.
- [ ] CLI output includes the created product identifier.
- [ ] CLI output includes merchant verification details.
- [ ] CLI validation and API validation failures are visible as structured errors.
- [ ] The command is top-level under `product`, not hidden under generic CRUD wording.
- [ ] The command suggests useful next actions such as fetching or updating the product.

---

## Phase 3: Patch-update product name and price through the API

**User stories**: 14, 15, 16, 17, 18, 19, 20, 21, 28

### What to build

Implement patch-based product updates for the narrow fields required by the smoke workflow. An authenticated operator can update the product name, price, or both. The server fetches the existing Product, merges only supported patch fields, preserves unsupported state and existing resource links, syncs the Stripe product name, creates a new Stripe Price when the price changes, deactivates replaced price records, verifies the resulting merchant linkage, and returns the product plus merchant verification summary.

### Acceptance criteria

- [ ] `PUT /api/products` accepts a product identifier plus optional name and price fields.
- [ ] Update uses patch semantics and does not require the full product shape from the caller.
- [ ] Unsupported fields are ignored or rejected clearly without mutating product state.
- [ ] Name updates sync to the local product and Stripe product.
- [ ] Price updates use USD dollars and the same two-decimal validation rule as creation.
- [ ] Price changes create a new active Stripe Price.
- [ ] Replaced Stripe Price records are deactivated where possible.
- [ ] Replaced local MerchantPrice records are deactivated.
- [ ] Existing product type, fields, status, quantity, and resource links are preserved unless explicitly supported later.
- [ ] Operators without update permission fail.
- [ ] Successful update returns the updated Product and merchant verification summary.
- [ ] A mutation does not return success unless the updated merchant linkage is verified.

---

## Phase 4: Add product update CLI command

**User stories**: 2, 16, 17, 21, 25, 26, 29

### What to build

Expose the patch update API through a top-level operator CLI command. The CLI accepts a product identifier and optional name and price flags, sends the patch to CodeTV, and prints structured output with the updated product and merchant verification summary.

### Acceptance criteria

- [ ] `cb product update <product-id> --name <name> --app codetv` sends a name patch.
- [ ] `cb product update <product-id> --price <usd> --app codetv` sends a price patch.
- [ ] `cb product update <product-id> --name <name> --price <usd> --app codetv` sends both fields in one patch.
- [ ] CLI price input uses the same USD dollar semantics as the API.
- [ ] CLI output includes the updated product identifier.
- [ ] CLI output includes merchant verification details.
- [ ] CLI errors are structured when validation, auth, update, or merchant verification fails.
- [ ] The command is top-level under `product`, not hidden under generic CRUD wording.
- [ ] The command suggests useful next actions such as fetching the product or starting checkout smoke verification.

---

## Phase 5: Expose operator merchant verification on product reads

**User stories**: 22, 23, 33, 35

### What to build

Enhance authenticated operator product reads so a product fetch can answer whether the product is sellable without direct database or Stripe spelunking. Existing product fetch behavior remains compatible, but operator responses include merchant verification details by default.

### Acceptance criteria

- [ ] Authenticated operator `GET /api/products?slugOrId=<id-or-slug>` includes merchant verification for the returned product.
- [ ] Authenticated operator product list responses include merchant verification where practical without making the list endpoint unusably expensive.
- [ ] Merchant verification identifies missing or inactive local merchant linkage.
- [ ] Merchant verification identifies the active Stripe product and price identifiers when available.
- [ ] Existing CLI product list/get behavior remains compatible.
- [ ] Merchant verification details remain operator-only and are not exposed through public product reads if route access changes later.

---

## Phase 6: Failure handling and cleanup hardening

**User stories**: 11, 12, 13, 32, 35

### What to build

Harden the product mutation path so partial failures are explicit, observable, and as safe as possible. Because DB writes and Stripe calls cannot be one transaction, mutations fail hard, verify after mutation, attempt best-effort archival/deactivation when partial records are identifiable, and log cleanup failures separately.

### Acceptance criteria

- [ ] Product creation returns failure if Stripe product creation fails.
- [ ] Product creation returns failure if Stripe price creation fails.
- [ ] Product creation returns failure if local merchant linkage cannot be verified.
- [ ] Product update returns failure if merchant linkage cannot be verified after update.
- [ ] Failed creation attempts best-effort soft cleanup/archive of identifiable local product state.
- [ ] Failed update attempts best-effort preservation or cleanup of identifiable merchant state.
- [ ] Cleanup prefers archive/deactivation over hard delete.
- [ ] Cleanup failures are logged separately from the original mutation failure.
- [ ] Failure responses are structured and do not imply that a product is sellable.
- [ ] Logs provide enough context for support/debugging without exposing secrets.

---

## Phase 7: End-to-end smoke runbook

**User stories**: 24, 25, 26, 30, 34, 35

### What to build

Document and validate the operator smoke workflow that proves the CourseBuilder Product foundation is ready for checkout work. The runbook should create a no-resource product, update the name, update the price, fetch the product, confirm merchant verification, and record what to inspect in CodeTV and Stripe. It should also note that this app-local workflow is a candidate for upstream CourseBuilder extraction after validation.

### Acceptance criteria

- [ ] Runbook shows how to create a smoke product through the CLI.
- [ ] Runbook shows how to update the smoke product name through the CLI.
- [ ] Runbook shows how to update the smoke product price through the CLI.
- [ ] Runbook shows how to fetch the smoke product and inspect merchant verification.
- [ ] Runbook lists the local CourseBuilder records expected after creation.
- [ ] Runbook lists the local CourseBuilder records expected after a price update.
- [ ] Runbook lists the Stripe records expected after creation and update.
- [ ] Runbook explains that products can be no-resource smoke artifacts before Workshop Ticket checkout is implemented.
- [ ] Runbook notes the future upstream CourseBuilder extraction opportunity.
- [ ] Running the smoke workflow gives enough confidence to proceed to checkout/session/webhook verification.
