# SEO TeamDesk UI Design Specification

Version: 1.0

Stitch Project:

17869850438131362006

---

# 1. DESIGN OBJECTIVE

Redesign SEO TeamDesk into a modern, professional SEO operations platform.

The UI should feel:

- professional
- clean
- modern
- technical
- trustworthy
- information-dense without being cluttered
- enterprise-ready
- fast
- consistent

The design should feel like a serious SEO operations platform rather than a generic admin dashboard.

---

# 2. DESIGN REFERENCE

Google Stitch is the primary visual reference.

Stitch contains Light and Dark versions of the major screens.

Use Stitch to determine:

- layout
- hierarchy
- spacing
- typography
- color relationships
- component appearance
- visual density
- responsive behavior

Do not blindly copy generated HTML.

The implementation must fit the existing Next.js architecture.

---

# 3. DESIGN PHILOSOPHY

## Visual hierarchy

Every page should have a clear hierarchy:

Application shell
→ page header
→ primary action/context
→ main content
→ supporting information
→ secondary actions

Users should understand what they are looking at within seconds.

---

# 4. CONSISTENCY

Repeated patterns must look and behave consistently.

Examples:

Buttons used throughout the application should share:

- height
- radius
- typography
- icon alignment
- hover behavior
- focus behavior

Forms should share:

- label treatment
- input height
- border
- radius
- error state
- focus state

Tables should share:

- header treatment
- row height
- hover treatment
- status badges
- pagination
- empty states

---

# 5. COLOR SYSTEM

Use semantic design tokens.

Avoid page-specific hard-coded colors where possible.

Required semantic categories:

## Background

- application background
- surface
- elevated surface
- card

## Text

- primary
- secondary
- muted
- disabled
- inverse

## Brand

- primary
- primary foreground
- secondary

## State

- success
- warning
- error/destructive
- information

## Borders

- default
- subtle
- strong

Light and Dark Mode must use different token values while preserving semantic meaning.

---

# 6. TYPOGRAPHY

Typography must establish clear hierarchy.

Use a consistent scale for:

- page title
- section title
- card title
- body
- secondary text
- labels
- captions
- table text
- badges

Avoid excessive font-size variation.

Text should remain readable at desktop and mobile sizes.

---

# 7. SPACING

Use a consistent spacing system.

Prefer Tailwind spacing tokens rather than arbitrary values.

Repeated spacing patterns should remain consistent between pages.

Typical hierarchy:

Small:
icons, badges, inline controls

Medium:
form fields, table rows, card content

Large:
sections and page-level separation

Extra large:
major page regions

---

# 8. BORDER RADIUS

Use a consistent radius system.

Small radius:
inputs, compact controls

Medium radius:
buttons, cards

Large radius:
major containers/modal surfaces where appropriate

Do not randomly mix many radius values.

---

# 9. SHADOWS

Shadows should communicate elevation rather than decoration.

Use:

- subtle elevation for cards
- stronger elevation for dialogs/popovers
- minimal or no shadow for flat table surfaces

Dark mode shadows must remain subtle and appropriate.

---

# 10. BUTTONS

Buttons should have consistent:

- height
- horizontal padding
- typography
- radius
- icon spacing
- focus ring
- disabled state
- hover state
- active state

Required conceptual variants:

- primary
- secondary
- outline
- ghost
- destructive
- icon

Use existing shadcn-style button infrastructure where appropriate.

---

# 11. FORM INPUTS

Inputs should provide:

- visible label
- clear focus state
- consistent height
- consistent radius
- predictable placeholder
- disabled state
- error state
- accessible focus indicator

Do not rely only on color to communicate errors.

---

# 12. CARDS

Cards should provide visual grouping without excessive decoration.

Card hierarchy:

Header
Content
Optional footer/actions

Use consistent:

- padding
- border
- radius
- background
- shadow

---

# 13. TABLES

SEO TeamDesk contains information-heavy workflows.

Tables should prioritize:

- scanability
- column hierarchy
- status visibility
- row consistency
- responsive behavior

Avoid overly decorative tables.

On smaller screens, prefer:

- horizontal scrolling
- responsive column prioritization
- stacked metadata

rather than breaking the table.

---

# 14. STATUS INDICATORS

Use badges/status indicators consistently.

Concepts include:

- success
- running
- pending
- failed
- warning
- inactive
- completed

Do not rely only on color.

Where appropriate combine:

icon + text + color.

---

# 15. LOADING STATES

Loading should communicate progress clearly.

Prefer:

- skeletons for page/content loading
- spinners for short actions
- progress indicators for long operations

Do not freeze the interface unnecessarily.

---

# 16. EMPTY STATES

Empty states should explain:

1. What is empty?
2. Why is it empty?
3. What can the user do next?

Avoid blank screens.

---

# 17. ERROR STATES

Errors should be:

- visible
- understandable
- actionable where possible
- consistent across screens

Do not expose internal stack traces or implementation details to users.

Preserve existing error behavior during redesign.

---

# 18. NAVIGATION

The dashboard shell should provide clear navigation between:

- Scripts
- Lastmod Updater
- Sitemap Cleaner
- Backlink Sites
- Backlinks Tracker
- Websites
- Weekly Reports
- Daily Reports
- Website Audit
- Execution Logs
- User Management
- Settings

Navigation should communicate:

- current location
- available actions
- hierarchy

---

# 19. PAGE HEADER

Dashboard pages should generally contain:

- page title
- short contextual description where useful
- primary action
- optional secondary actions

Avoid unnecessary large headers.

---

# 20. DARK MODE

Dark Mode is a first-class design.

Do not simply invert Light Mode.

Dark Mode should have intentional:

- background hierarchy
- card hierarchy
- text contrast
- border contrast
- accent colors
- shadows
- hover states

---

# 21. LIGHT MODE

Light Mode should feel:

- clean
- bright
- professional
- readable

Avoid excessive pure-white surfaces if Stitch uses layered surfaces.

---

# 22. RESPONSIVE DESIGN

Minimum supported reference sizes:

Desktop:
1440 × 900

Tablet:
1024 × 768

Mobile:
390 × 844

The UI must not:

- horizontally overflow unexpectedly
- clip controls
- hide critical actions
- make tables unusable
- make forms difficult to complete

---

# 23. MOBILE

Mobile should not simply be a scaled desktop.

Where necessary:

Desktop:
sidebar + content

Mobile:
compact navigation + content

Desktop:
multi-column forms

Mobile:
stacked forms

Desktop:
wide table

Mobile:
responsive table/card treatment

---

# 24. ICONS

Use the existing icon system where possible.

Icons should:

- have consistent size
- align with text
- communicate meaning
- not replace important text unnecessarily

Avoid decorative icon overload.

---

# 25. ANIMATION

Animations should be subtle.

Use animation for:

- page transitions
- dialogs
- dropdowns
- hover feedback
- loading

Avoid excessive motion.

Respect accessibility preferences where practical.

---

# 26. ACCESSIBILITY

Maintain:

- keyboard navigation
- focus indicators
- semantic HTML
- labels
- readable contrast
- accessible dialogs
- accessible controls

---

# 27. PERFORMANCE

UI redesign must not introduce unnecessary:

- client components
- heavy dependencies
- large images
- animation libraries
- duplicated components

Prefer the existing stack.

---

# 28. COMPONENT REUSE

If the same design appears twice, consider making it reusable.

Potential shared components:

- AppShell
- Sidebar
- Topbar
- PageHeader
- PageContainer
- Card
- DataTable
- StatusBadge
- EmptyState
- LoadingState
- FormField
- ThemeToggle
- ConfirmDialog
- SearchInput
- FilterBar

Do not create abstractions prematurely.

Extract components when repetition or design consistency justifies them.

---

# 29. STITCH + EXISTING APPLICATION

The design hierarchy is:

1. Existing business behavior
2. Existing application architecture
3. Stitch visual design
4. Accessibility
5. Responsive requirements
6. Visual polish

If Stitch conflicts with existing business behavior:

Preserve business behavior.

Adapt the UI.

---

# 30. DEFINITION OF DONE

A redesigned screen is complete only when:

- Stitch Light inspected
- Stitch Dark inspected
- Existing implementation inspected
- Playwright browser verification completed
- Functional behavior verified
- Light Mode verified
- Dark Mode verified
- Desktop verified
- Tablet verified
- Mobile verified
- Build/type checks pass
- Existing tests pass
- No unrelated business logic changed
- Visual discrepancies have been reviewed