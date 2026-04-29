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
