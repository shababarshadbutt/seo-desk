# SEO TeamDesk — Claude Code Instructions

## Project

SEO TeamDesk is a Next.js 14 application using:

- Next.js 14 App Router
- React 18
- TypeScript
- Tailwind CSS
- shadcn/ui-style components
- Radix UI primitives
- NextAuth v4
- MongoDB

The application provides SEO automation and reporting tools.

---

# PRIMARY RULE

This project is undergoing a UI/UX redesign.

The redesign is PRESENTATION ONLY.

The existing application behavior is the source of truth.

Never change business behavior merely to make a UI implementation easier.

---

# ABSOLUTELY DO NOT CHANGE

Unless explicitly instructed otherwise, do not modify:

- authentication behavior
- NextAuth configuration
- credentials validation
- authorization
- middleware rules
- API contracts
- API endpoints
- database queries
- MongoDB models
- repositories/data-access behavior
- business rules
- background jobs
- automation logic
- sitemap processing logic
- Lastmod processing logic
- script execution behavior
- session/token behavior
- routing behavior
- existing integrations
- existing workflows

Particularly protected files include:

- `lib/auth.ts`
- `middleware.ts`
- `app/api/**`
- `lib/mongodb/**`
- `lib/lastmod/**`
- `lib/sitemapCleaner/**`
- `lib/scripts-config.ts`
- `components/missed-report-guard.tsx`
- `components/session-provider.tsx`
- `asap-scripting/**`
- `scripts/**`
- `tools/**`

A page/server component may contain both data fetching and presentation.

Before modifying a `page.tsx` file, inspect whether it contains business/data logic.

---

# UI REDESIGN PRINCIPLE

The objective is:

Existing behavior
+
New Stitch-based presentation
=
Same application with significantly improved UX/UI.

Do not rewrite working functionality just because the Stitch design uses a different implementation.

Adapt the design to the existing architecture.

Do not adapt business behavior to the design.

---

# DESIGN SOURCE OF TRUTH

Google Stitch project:

17869850438131362006

Stitch should be used as the visual design reference.

Use Stitch MCP to inspect:

- screen HTML
- screenshots
- Light Mode designs
- Dark Mode designs

Do not assume the Stitch HTML should be copied literally.

Extract the design language and implement it using the existing application's architecture.

---

# BROWSER SOURCE OF TRUTH

Playwright MCP is the browser verification tool.

After implementing UI changes, use Playwright to verify the actual rendered application.

The verification sequence should be:

1. Start/inspect the application.
2. Open the target route.
3. Verify the page renders.
4. Verify functionality still works.
5. Verify responsive layouts.
6. Verify Light Mode.
7. Verify Dark Mode.
8. Capture/inspect screenshots.
9. Compare against Stitch.
10. Identify visual differences.
11. Fix presentation issues.
12. Re-run verification.

Do not claim visual correctness without browser verification when Playwright is available.

---

# IMPLEMENTATION RULE

For each screen:

1. Inspect existing implementation.
2. Inspect Stitch Light design.
3. Inspect Stitch Dark design.
4. Inspect existing application using Playwright.
5. Create an implementation plan.
6. Implement only the required presentation changes.
7. Run tests/build/type checks.
8. Verify with Playwright.
9. Compare against Stitch.
10. Fix visual discrepancies.
11. Verify again.
12. Report changed files.

Do not skip directly from Stitch → code.

---

# DESIGN SYSTEM FIRST

Do not create completely independent styling for every page.

The application should gradually develop a shared design system.

Prefer reusable:

- theme tokens
- buttons
- inputs
- cards
- tables
- badges
- dialogs
- page headers
- section headers
- navigation
- status indicators
- empty states
- loading states
- form controls

If a visual pattern appears on multiple Stitch screens, make it reusable.

Avoid copy/paste styling between pages.

---

# LIGHT AND DARK MODE

The application must support both:

- Light Mode
- Dark Mode

Use the existing Tailwind CSS variable architecture where possible.

Prefer semantic tokens such as:

- background
- foreground
- card
- card-foreground
- muted
- muted-foreground
- border
- input
- primary
- primary-foreground
- destructive

Do not scatter hard-coded colors throughout components when semantic tokens can be used.

Do not duplicate entire page markup solely for Light/Dark mode.

Prefer one component with theme-aware tokens.

---

# RESPONSIVE DESIGN

Every redesigned screen must work at minimum at:

Desktop:
1440 × 900

Tablet:
1024 × 768

Mobile:
390 × 844

Also consider wider desktop displays.

Do not allow:

- horizontal overflow
- clipped controls
- unreadable text
- inaccessible buttons
- broken tables
- unusable forms

Responsive behavior should be intentional.

---

# ACCESSIBILITY

Maintain or improve:

- semantic HTML
- labels
- keyboard navigation
- focus states
- sufficient contrast
- accessible buttons
- accessible form controls
- appropriate ARIA attributes where required

Do not remove existing accessibility behavior during redesign.

---

# FUNCTIONAL PRESERVATION

Before changing a screen, identify its existing:

- state
- handlers
- API calls
- navigation
- validation
- loading state
- error handling
- permissions
- data dependencies

These must continue behaving the same after redesign.

UI state may be visually reorganized, but its meaning and behavior must remain unchanged.

---

# LOGIN SPECIAL RULE

For Login:

Keep the existing authentication flow.

Do not change:

`signIn("credentials", ...)`

Do not change:

- credentials passed to signIn
- redirect behavior
- error handling semantics
- loading semantics
- successful navigation
- session behavior

The Login redesign is strictly presentation-oriented.

---

# FILE MODIFICATION DISCIPLINE

Before modifying a file:

Explain internally why it is required.

Prefer the smallest possible change.

Do not refactor unrelated code while redesigning a screen.

Do not perform opportunistic cleanup unless explicitly requested.

---

# VERIFICATION

Every completed screen should pass:

## Functional

- existing functionality works
- existing validation works
- existing API interactions work
- existing navigation works
- existing loading states work
- existing error states work

## Visual

- Stitch Light comparison
- Stitch Dark comparison
- desktop
- tablet
- mobile

## Technical

- TypeScript/build checks
- existing tests
- no new console errors
- no runtime errors

---

# GIT

Current UI redesign branch:

`ui-revamp`

Do not switch branches unless explicitly instructed.

Do not commit unless explicitly requested.

Do not push unless explicitly requested.

---

# REPORTING

After completing a screen, report:

### Changed

Files modified and why.

### Preserved

Important application behavior that was intentionally preserved.

### Verification

- build
- tests
- Playwright
- responsive checks
- Light Mode
- Dark Mode

### Stitch comparison

Remaining differences, if any.

### Risks

Any uncertainty or issue requiring human review.

---

# IMPORTANT

Never say a screen is "done" merely because it compiles.

A screen is complete only when:

Implementation
+
Functional verification
+
Playwright verification
+
Responsive verification
+
Stitch visual comparison

have been completed.