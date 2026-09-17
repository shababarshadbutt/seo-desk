# Weekly Reports Screen

Route:

`/weekly-reports`

---

# Stitch References

Project: `17869850438131362006`

Light: `4f441aa530094cd1a237d26bf1c05d29` ("SEO TeamDesk - Weekly Reports (Light Mode)")

Dark: `74e64e71980748468c447a05ac6af73c` ("SEO TeamDesk - Weekly Reports (Dark Mode)")

Single unambiguous Light/Dark pair — Hard Gate 2 not triggered.

**Scope note (superseded — see Part F below)**: originally the Stitch mock's AI button, bar/donut charts, and CSV/PDF export weren't built. Since then: the bar chart, CSV export, and a stubbed AI button were built (Part B); the donut chart and the rest of the richer mock were built in Part F.

---

# Existing Implementation

Primary files:

- `app/(dashboard)/weekly-reports/page.tsx` (server component — role-based data fetching: assigned websites, member list, report filter)
- `app/(dashboard)/weekly-reports/weekly-reports-client.tsx` (grouped member/month/week view, own-submissions table, bulk-add + edit + delete dialogs)

Related presentation: `components/ui/{button,input,label,dialog}.tsx`

---

# Discovery (Phase 12)

- **Role-based views**: super-admin and sub-lead see the grouped view (by member → month → week, collapsible, with running totals); every non-super-admin role additionally sees their own submissions as a flat table with Add/Edit/Delete.
- **Filters** (grouped view only): member dropdown (role-gated, sub-lead sees own group), month dropdown — both client-side filtering.
- **Grouping/totals**: `groupReports` builds userId → monthKey → weekStart → rows; `sumRows` computes Week Total / Month Total / member grand-total (header row).
- **Add flow**: bulk form — one week selector + one row per assigned website (Clicks/Impressions/Indexation/RFQs inputs), submits one `POST /api/weekly-reports` per website sequentially.
- **Edit flow**: single-row form, `PATCH /api/weekly-reports/:id`.
- **Delete flow**: confirm dialog, `DELETE /api/weekly-reports/:id`.
- **Already largely on the design system**: unlike Indexing Queue, this screen already used semantic tokens (`bg-card`, `text-muted-foreground`, `text-destructive`, etc.) throughout — this phase was a smaller normalization pass, not a full migration.
- **Pre-existing defects found and fixed** (same classes as prior phases):
  - Hover-only-reveal edit/delete actions (`opacity-0 group-hover:opacity-100`) in both the own-submissions table and the grouped week-row table — same accessibility gap as Websites/Backlink Sites/Backlinks Tracker, now always-visible.
  - Hardcoded `bg-blue-50/50`/`text-blue-700` on the "Week Total" row (the "Month Total" row already correctly used `bg-primary/5`) — normalized to `primary`.
  - `rounded-md` on selects/table containers — normalized to `rounded-lg`; card/table outer containers → `rounded-xl`.
  - Missing `key` prop on a `<>` Fragment wrapping each week's rows in `MonthSection` (real pre-existing React console error, unrelated to styling — fixed by converting to `<Fragment key={weekStart}>` since I was already touching this exact block for the styling/accessibility fix).
  - No `DialogDescription` on any of the 3 dialogs (Add/Edit/Delete) — added, consistent with the app-wide pattern established in Phase 4.
- **Real API calls**: `POST /api/weekly-reports`, `PATCH /api/weekly-reports/:id`, `DELETE /api/weekly-reports/:id` — protected, consumed only.

---

# Part F — Pixel-fidelity redesign (exact Stitch match + real structure for placeholders, 2026-09-16)

Same situation as Daily Reports (Part D) and Login (Part E): the user shared real Stitch screenshots (two variants) plus the current live screen, and asked for the missing pieces — specifically the donut chart and richer stat cards. This time, with an important upgrade to the approach: **rather than purely client-side computed placeholders, every concept with no real data source got a real schema, a real collection, and a real editable API route — seeded with a placeholder value.** The user's own words: *"if there is need of schema for that make that schema and functionality in the backend and DB and add some fake values so after the deployment we can add some real values so if the structure is there then it will be easy to add values."*

## New backend (all new files — zero existing protected file touched)

- **`lib/mongodb/models/UserProfile.ts`** + **`app/api/user-profiles/route.ts`** (bulk `GET ?userIds=`, auto-seeds missing profiles) + **`app/api/user-profiles/[userId]/route.ts`** (`PATCH { title }`, super-admin or self). One doc per user; job title, seeded from `lib/fake-user-titles.ts` (renamed from Daily Reports' Part D file — the same generic generator, now used for both screens via this shared collection instead of two independent client-side fakes).
- **`lib/mongodb/models/WebsiteProfile.ts`** + **`app/api/website-profiles/route.ts`** (bulk `GET ?websiteIds=`, auto-seeds) + **`app/api/website-profiles/[websiteId]/route.ts`** (`PATCH { industry }`, super-admin only). One doc per website; industry vertical, seeded from `lib/fake-website-industries.ts` — pool chosen to match this app's real, overwhelmingly aviation/aerospace-parts-supply-chain dataset (Aerospace & Defense, Fasteners & Hardware, Electromechanical Parts, Commercial MRO, Industrial Supply, Electronics & Avionics), and matching Stitch's own industry labels.
- **`lib/mongodb/models/ReportMetricsConfig.ts`** + **`app/api/report-metrics-config/route.ts`** (`GET` auto-creates the singleton with seed values; `PATCH`, super-admin only, partial update). Same singleton pattern as the existing, protected `Settings` model, in a new file: `weeklyClickTarget` (seed 3000), `serpVisibilityIndex` (seed 94.8), `verifiedUrlRatio` (seed 98.4), `avgValuePerQuote` (seed 14250).

Every one of these is a genuinely real, working CRUD path — not a display-only fake. Verified live: a real `PATCH /api/report-metrics-config` edit was made through the new "Edit target/index values" UI, confirmed to persist (`isPlaceholder` flipped from `true` to `false`), then reverted to the seed number afterward (the flag correctly stayed `false`, since a real edit action occurred — reverting the number doesn't un-happen the edit).

## What's real vs. placeholder-with-real-structure

| Element | Status | Backing |
|---|---|---|
| 4 stat cards (Total Clicks/Impressions/Indexation/RFQs) | **REAL** | Sums over the same rows already driving the chart, no schema needed |
| Stat card trend deltas | **REAL** | First-half vs second-half of the visible 12-week window, real % change |
| "Managed Domains" | **REAL** | Distinct `websiteId` count in view |
| "Weekly Target/Achieved", "SERP Visibility Index", "Verified URL Ratio", "Avg Value/Quote" | **Real structure, seeded value** | `ReportMetricsConfig`, editable via the new in-page dialog |
| "RFQ Industry Breakdown" donut + legend + center total | **Real structure, seeded value** | Groups visible rows by each website's `WebsiteProfile.industry` |
| "Top Performer: {industry} +N% conversion" | **REAL** | Top industry segment's real `rfqs/clicks` |
| Bar chart "Top Contributor" / "Conversion Rate" | **REAL** | Real arithmetic over visible rows |
| "Executive Visuals" / "Detailed Breakdown" tabs | **REAL** | Toggles stat-cards+charts vs. the existing drill-down table |
| Reset Filters | **REAL** | Clears member/month state |
| Per-member job title | **Real structure, seeded value** | `UserProfile.title`, editable per-user |
| Per-member "N Websites Assigned" | **REAL** | Distinct `websiteId` count for that member's visible rows |
| Sidebar/topbar, breadcrumb, "Sync Engine" pill, ⌘K search styling | **Out of scope** | Shared dashboard shell, same decision as Parts D/E |

## Files touched
- New: 3 models, 5 routes, 2 lib files (`lib/fake-website-industries.ts`; `lib/fake-user-titles.ts` is a rename of Daily Reports' Part D `lib/daily-report-fake-titles.ts`, now shared).
- Rewritten (not protected): `app/(dashboard)/weekly-reports/weekly-reports-client.tsx`.
- Extended (not protected): `app/(dashboard)/weekly-reports/page.tsx` (passes `updatedAt` through); `app/(dashboard)/daily-reports/reports-client.tsx` (migrated from the old client-side-only fake title to the new shared `UserProfile` fetch, so both screens now show the same real, DB-backed title per person instead of two independently-computed fakes).

Verified live: tsc/lint/build clean, protected-file guard clean (every backend file new), real stat totals/deltas/donut cross-checked, a real config edit persisted and reverted correctly, Daily Reports re-confirmed unaffected after the title-source migration (same titles render, now DB-backed), existing Add/Edit/Delete/Export/AI-stub flows all re-confirmed working, 0 console errors across desktop/tablet/mobile × Light/Dark.

---

# Part G — Reuse pass + remaining Stitch gaps + PDF stub (2026-09-17)

A direct re-comparison against the actual Stitch mocks turned up a design-system reuse gap (this screen had drifted from components other screens already consolidated onto) plus a handful of visual/functional elements Stitch has that Part F didn't build. Per the user's explicit decision, PDF export is stubbed rather than adding a new PDF-generation dependency.

## Reuse fixes (no new visual pattern — switched to the existing shared component)
- Local `StatCard` (duplicated icon-box card) → `components/ui/stat-card.tsx`'s shared `StatCard` (same one Websites uses). Widened that shared component in the process: added a `sky` color option and widened `caption` from `string` to `ReactNode` (both additive, non-breaking — verified against Websites' existing plain-string usages).
- Hand-rolled avatar circle in `MemberSection` → `<AvatarChip>` (`components/ui/avatar-chip.tsx`), the same component already extracted from this exact duplicated pattern on Indexing Queue/Website Audit/Websites.
- Duplicated `formatRelativeTime` (previously a local function in `websites-client.tsx`) → extracted to `lib/format-relative-time.ts`, imported by both screens.

## New, real, Stitch-matched elements
- Donut center total ("124 / Total RFQs") — real, `donutTotal`.
- Bar chart header trend badge ("+N% WoW") — real, same first-half/second-half split already used for the stat-card deltas, applied to combined clicks+rfqs.
- "View Historical Trends" link next to the Top Contributor line — stub (`useFunctionalityStub`), no trends drill-down view exists yet.
- "Expand All" / "Collapse All" + "Showing X of Y Specialists" on the grouped section header — real; each member section's open/closed state was lifted from a local `useState` into the parent so it can be controlled in bulk.
- Per-row "Health Status" badge in the detailed week table — real structure, seeded value: reuses `WebsiteProfile.healthScore`/`healthIsPlaceholder`, already returned by the existing `GET /api/website-profiles` route (used by the Websites screen) and already fetched here for `industryMap` — only the type was widened to also read the fields that were already in the response.
- "Updated N ago" freshness label next to the Member/Month filters — real, from the max `updatedAt` across the rows the viewer can see.
- Wording matched to Stitch: "Add Weekly Report" → "Submit Weekly Report"; "Weekly Output Velocity" → "Weekly Clicks & RFQs Velocity".

## New placeholder (added, tracked)
| Element | Where | What real implementation needs |
|---|---|---|
| PDF export | Header, split "CSV / PDF" export control | A PDF-generation library + a new `/api/weekly-reports/export/pdf` route rendering the same rows as CSV. User's explicit decision: stub for now (`useFunctionalityStub`, same convention as AI Executive Summary), CSV stays real and unchanged. |

## Files touched
- Rewritten (not protected): `app/(dashboard)/weekly-reports/weekly-reports-client.tsx`.
- Extended (not protected, additive/non-breaking): `components/ui/stat-card.tsx` (`sky` color, `caption: ReactNode`).
- Extended (not protected): `app/(dashboard)/websites/websites-client.tsx` (now imports `formatRelativeTime` from the new shared file instead of defining it locally).
- New: `lib/format-relative-time.ts`.
- No protected file touched; no backend/API/schema change — `/api/website-profiles` already returned everything the Health Status column needed.

Verified: `tsc --noEmit` clean, `next build` clean (0 lint/type errors), all 26 routes built successfully. Live Playwright verification (screen render, responsive, Light/Dark, functional walkthrough) could not be completed this pass — the shared Playwright browser profile was locked by another in-progress session for the whole session, and forcing it closed was avoided since Chrome had ~17 other windows/processes open that weren't ours to close. Stitch Light/Dark reference screenshots were downloaded and reviewed pixel-by-pixel against the code changes above; a live Playwright pass against `http://localhost:3004/weekly-reports` (desktop/tablet/mobile × Light/Dark) is still owed before this can be called fully verified.
