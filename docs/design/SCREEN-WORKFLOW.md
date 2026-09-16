# Screen Redesign Workflow

This document defines how Claude Code must redesign each screen.

---

# PHASE 1 — DISCOVER

Before writing code:

1. Identify the route.
2. Identify the current page/component.
3. Identify child components.
4. Identify styles.
5. Identify data dependencies.
6. Identify state.
7. Identify event handlers.
8. Identify API calls.
9. Identify navigation.
10. Identify validation.
11. Identify loading/error states.

Do not modify files.

---

# PHASE 2 — STITCH

Use Stitch MCP.

Retrieve:

- Light design
- Dark design
- HTML
- screenshots

Analyze:

- layout
- dimensions
- typography
- colors
- spacing
- components
- responsive behavior

Do not implement yet.

---

# PHASE 3 — PLAYWRIGHT BASELINE

Use Playwright MCP.

Open the current route.

Record:

- screenshot
- layout
- responsive behavior
- console errors
- runtime errors
- current interactions

Test at:

1440 × 900
1024 × 768
390 × 844

If the app is not running:

Do not modify startup configuration.

Report that browser verification is blocked.

---

# PHASE 4 — IMPLEMENTATION PLAN

Before coding, determine:

### Safe presentation files

Files that can be changed.

### Protected files

Files containing behavior that must remain unchanged.

### Shared components

Components that should be reused.

### New components

Components that should be introduced.

Keep the implementation minimal.

---

# PHASE 5 — IMPLEMENT

Implement only the presentation changes.

Do not:

- rewrite APIs
- change database logic
- change business rules
- change authentication
- change navigation behavior
- change API contracts

Preserve existing handlers and state semantics.

---

# PHASE 6 — TECHNICAL VERIFICATION

Run:

- TypeScript checks
- lint
- build
- existing tests

Do not modify business logic to make tests pass.

If a test fails because of an existing issue, report it separately.

---

# PHASE 7 — PLAYWRIGHT VERIFICATION

Open the redesigned route.

Test:

## Rendering

- page loads
- no runtime error
- no console error introduced

## Functionality

- existing interactions work
- validation works
- loading works
- errors work
- navigation works

## Responsive

1440 × 900
1024 × 768
390 × 844

## Themes

Light Mode
Dark Mode

Capture screenshots.

---

# PHASE 8 — VISUAL COMPARISON

Compare Playwright screenshots against Stitch.

Evaluate:

- structure
- spacing
- dimensions
- typography
- colors
- borders
- shadows
- icons
- alignment
- responsive behavior

Classify differences:

P0:
Structural mismatch

P1:
Major visual mismatch

P2:
Moderate mismatch

P3:
Polish

---

# PHASE 9 — CORRECTION

Fix P0/P1 issues first.

Then P2.

Then P3 if practical.

Do not introduce business-logic changes.

After corrections:

Repeat Playwright verification.

---

# PHASE 10 — COMPLETION

A screen can be considered complete only after:

- implementation
- technical verification
- functional verification
- browser verification
- responsive verification
- theme verification
- Stitch comparison

are complete.

---

# FINAL REPORT

Return:

## Implementation

Changed files.

## Preserved Behavior

Important behavior preserved.

## Tests

Build/lint/type/tests.

## Playwright

Browser verification results.

## Responsive

Desktop/tablet/mobile.

## Theme

Light/Dark.

## Stitch Comparison

Remaining differences.

## Risks

Known issues.

## Next Screen

Recommended next screen to implement.