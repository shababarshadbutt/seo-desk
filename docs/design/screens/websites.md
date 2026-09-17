# Websites Screen

Route:

`/websites`

---

# Stitch References

Project:

`17869850438131362006`

Light:

`5d366bd87f9d4b1b96dcb515d399bfd1` ("SEO TeamDesk - Websites (Light Mode)")

Dark:

`24ffdd40211444e18494e2b74f540f8c` ("SEO TeamDesk - Websites (Dark Mode)")

Single unambiguous Light/Dark pair, confirmed against the full 43-screen project listing. Hard Gate 2 not triggered.

---

# Existing Implementation

Primary files:

- `app/(dashboard)/websites/page.tsx` (server component — role-based data fetching)
- `app/(dashboard)/websites/websites-client.tsx` (client component — table, 5 dialogs, forms)

Related presentation:

- `components/ui/{button,input,label,dialog}.tsx`
- `app/globals.css`

---

# Discovery (Phase 4)

- **Real columns**: Website name (+ "Auto" badge if automation enabled), URL (external link), Assigned Members (pills), row actions (Automation/Assign/Edit/Delete — super-admin only).
- **Role-based data**: super-admin sees all + automation fields; sub-lead/regular sees only assigned websites, no automation fields exposed.
- **Member filter** (super-admin/sub-lead only): native `<select>`.
- **5 dialogs** (all via existing `Dialog` primitive): Add/Edit website form, Assign members (checkbox list), Automation settings (toggle + datetime + service-account searchable-select + Bing key + clear-sitemaps), Delete confirm.
- **Real API calls**: `POST/PATCH/DELETE /api/websites[/:id]`, `PATCH /api/websites/:id/automation` — all protected (`app/api/**`), not touched, only consumed as-is.
- **Custom `SearchableSelect`** component (inline in this file) for GSC service account picking — real, functional, keep as-is.

## Stitch vs. real data — content gap (same pattern as Login/Dashboard)

The Stitch mockup invents a much richer table than the real data model supports: fake CMS/framework detection badges, fake "Health Score" percentages, fake "Last Audited"/"Last Crawled" timestamps, bulk-select checkboxes, and a top row of 4 fabricated summary stat cards. At the time this note was first written, **none of this was implemented**. Both decisions have since been superseded:

- Bulk-select + bulk actions (enable/disable automation, delete) were built for real in Part B (see `PROGRESS.md`).
- CMS/Stack, SEO Health, and the 4 KPI cards were built in **Part G** (2026-09-17) — see below.

## Part G — pixel-fidelity pass: CMS/Stack, SEO Health, KPI cards, filters, pagination (2026-09-17)

Explicitly authorized by the user to build the previously-omitted Stitch elements as real functionality, following the exact placeholder-data pattern already established for `WebsiteProfile.industry` (Part F, Weekly Reports) and the presentational-status-pill pattern in `components/topbar.tsx`.

**New WebsiteProfile fields** (`lib/mongodb/models/WebsiteProfile.ts`, additive only — `industry`/`isPlaceholder` untouched, protected `Website` model never touched):
- `platform` / `platformIsPlaceholder` — CMS/tech-stack, deterministic hash-seeded pool (`lib/fake-website-platforms.ts`, salted `id + "-platform"` so it doesn't correlate with the industry hash).
- `healthScore` / `healthIsPlaceholder` — SEO health 0-100, deterministic hash-seeded (`lib/fake-website-health.ts`, salted `id + "-seo-health"`, skewed distribution: ~4-5% critical, ~15% notice, rest healthy). The **thresholds** (≥90 healthy / 75-89 notice / <75 critical) are real shared policy, not placeholder — taken directly from Stitch's own filter copy.
- `GET /api/website-profiles` seeds new docs with all fields and **backfills** existing Part-F-era docs (industry-only) so nothing renders blank for websites already touched by Weekly Reports.
- `PATCH /api/website-profiles/[websiteId]` now accepts optional `platform`/`healthScore` alongside `industry`, each clearing its own placeholder flag — the "editable to a real value later" half of the pattern (no UI calls this for platform/health yet — a natural follow-up).

**Known Placeholders** (disclosed via `title` tooltips in the UI, per this app's honesty-in-comments convention):
- CMS/Stack badge value — no real CMS detection exists.
- SEO Health score/pill and the "Average Health Score" / "Needs Review" KPI cards — no real health-check/monitoring exists.

**Real, non-placeholder additions**:
- "Last Updated" column — the real `Website.updatedAt` (added to the `WebsiteRow` DTO in `page.tsx`), honestly relabeled from Stitch's "Last Crawled" since no crawl timestamp exists.
- Client-side search (name/URL), Industry/Platform/Health filters (options derived from loaded data), "My Assigned Only" (now uses the previously-unused `currentUserId` prop), sort (name/health/last-updated), pagination (12/25/50/100 rows), Export CSV (client-side, escapes commas, omits the automation column for non-super-admin).
- "Audit" quick action navigates to the existing `/audit` page (no prefill — `/audit` reads no searchParams, a follow-up if wanted). "Fix Crawl" (shown for non-healthy rows, super-admin only) opens the existing Automation Settings dialog — zero new logic, just a new entry point.
- New shared `components/ui/avatar-chip.tsx` (+ `lib/avatar.ts`) — extracted the initials/color-chip pattern that was previously duplicated across Indexing Queue, Website Audit, Weekly Reports, and this screen's own Assign form.
- `components/ui/badge.tsx` gained a soft `danger` variant (Critical health pill); `components/ui/stat-card.tsx` gained optional `valueSuffix`/`badge`/`loading` props (all additive, existing call sites unaffected).

All existing role gating (`isSuperAdmin`, `canFilter`), dialogs, and API contracts preserved exactly — verified live via Playwright (functional regression + all new behavior, both themes, 1440×900/1024×768/390×844, 0 console errors).

## Pre-existing responsive defect confirmed at 390×844 baseline

Table wrapper uses `overflow-hidden` (not `overflow-x-auto`), so on mobile the Assigned Members and row-actions columns are **clipped entirely and inaccessible** — not just visually cramped, genuinely unreachable (no horizontal scroll possible). Must fix as part of this phase: change to a horizontally-scrollable container, per CLAUDE.md's "no broken tables" requirement.

## First genuine `DataTable` candidate — decision

Per the plan (Phase 1 §5 / v3 revision "no speculative abstractions"), a shared `DataTable` component is only built when a real, demonstrated pattern exists — not preemptively. This is the *first* table screen. **Decision: restyle this table in place** (not extract a `DataTable` component yet). If Backlinks/Users/Logs (later phases) show the same real pattern repeating, extract `DataTable` at that point and refactor this screen to use it too.
