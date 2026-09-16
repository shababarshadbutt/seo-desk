# Indexing Queue Workflow

Routes:

`/indexing-queue` (list) · `/indexing-queue/[websiteId]` (per-website detail)

---

# Stitch References

Project: `17869850438131362006`

**Gap resolved (Phase 11)** — no pre-existing Stitch reference existed for this route. Per user decision (2026-09-15): generate new designs in Stitch (opposite of the Content/Phase 10 approach, where generation was deferred). Generated 4 screens, all using design system `assets/16171290459238422641` (same asset as every other screen this session):

| State | Mode | Screen ID | Title |
|---|---|---|---|
| List | Light | `d466c1d774234375a16c7d796af142d5` | SEO TeamDesk - Indexing Queue (Light Mode) |
| List | Dark | `dfdd043915434e8fa396f7f275488840` | SEO TeamDesk - Indexing Queue (Dark Mode) |
| Detail | Light | `dcfe31828e8f4da4b29e0229746b1dd6` | SEO TeamDesk - Indexing Queue Detail (Light Mode) |
| Detail | Dark | `5e9efd026e904f77b54896a49e9cf65d` | SEO TeamDesk - Indexing Queue Detail (Dark Mode) |

Single unambiguous pair per state — Hard Gate 2 not triggered (these are the only candidates, since they were just generated to spec).

**Important scope note**: the Stitch prompts (necessarily, to get a rich realistic mock) included several elements that do **not** exist in the current implementation — a global search bar, "Dispatch Pending Batch" / "Export Queue CSV" / "Force Re-index All" / "Add Single URL" / "Refresh Status" buttons, filter tabs ("Has Pending", "Has Failures"), an "Inspect"/"Re-submit" per-row action, and sitemap validity/HTTP-status metadata. **Per the "No invented functionality" standing rule, none of these are implemented** — they have no corresponding existing capability (no dispatch API, no CSV export route, no re-index trigger, no per-sitemap validity tracking). Stitch is used here purely for layout/typography/color/spacing/card-and-table visual language, not as a literal feature spec. Any mismatch is noted below and will be called out again in the completion report.

---

# Existing Implementation

Primary files:

- `app/(dashboard)/indexing-queue/page.tsx` — server component, list view
- `app/(dashboard)/indexing-queue/[websiteId]/page.tsx` — server component, detail view (stats + sitemap data), renders `QueueClient`
- `app/(dashboard)/indexing-queue/[websiteId]/queue-client.tsx` — client component, sitemaps accordion + filters/search + paginated URL table

Related presentation: `components/ui/{badge}.tsx` (not currently used here — screen has zero shared-component usage)

---

# Discovery (Phase 11)

- **Access**: super-admin only (`session.user.role !== "super-admin"` → redirect `/`), both pages. No sub-lead/regular-user view exists for this route.
- **List page** (`/indexing-queue`):
  - Data: `Website.find({})` filtered client-side (server-side, in the loop) to `automationEnabled` websites only; `IndexingQueue.aggregate` grouped by `websiteId` for per-website GSC/Bing pending/submitted/failed counts.
  - Grand-total `SummaryCard` row (7 cards: Total/GSC Submitted/GSC Pending/GSC Failed/Bing Submitted/Bing Pending/Bing Failed) — computed via `rows.reduce`.
  - Table: Website (name+URL), Sitemaps count, Total URLs, GSC ✓/⏳/✗, Bing ✓/⏳/✗, and a `View` link to `/indexing-queue/[id]`.
  - Empty state: "No automation-enabled websites found."
  - No search, no filters, no pagination, no CSV export, no dispatch action on this page — it is read-only telemetry with one navigation action (View).
- **Detail page** (`/indexing-queue/[websiteId]`):
  - Data: `Website.findById` (404 via `notFound()` if missing), per-website `IndexingQueue.aggregate`, first page (`PAGE_SIZE=50`) of `IndexingQueue.find({ websiteId }).sort({ discoveredAt: -1 })`.
  - Header: back-link to `/indexing-queue`, website name + external link to `website.url`.
  - `StatCard` row (7 cards, same shape as list page's `SummaryCard`).
  - Delegates the rest to `QueueClient` (sitemaps + filters + table + pagination), passing `websiteId`, `initialWebsite` (incl. `sitemaps[]`), `initialUrls[]`, `initialPagination`.
- **`QueueClient`** (client-side, `"use client"`):
  - **Sitemaps panel**: collapsible (`sitemapsOpen` state, default closed), lists `initialWebsite.sitemaps` (url + discoveredAt), each a link; static from server props, does not re-fetch.
  - **Search**: local `searchInput` state, committed to `search` state on Enter or "Go" click (not live-as-you-type).
  - **GSC filter** / **Bing filter**: independent button groups (`all`/`pending`/`submitted`/`failed`), each driving a separate query param.
  - **Data fetch**: `useEffect` on `[gscFilter, bingFilter, search]` calls `GET /api/indexing-queue/[websiteId]?page=1&gscStatus=...&bingStatus=...&search=...` (always resets to page 1 on filter/search change), wrapped in `useTransition` (table dims to `opacity-50` while pending).
  - **URL table**: URL (+ inline GSC/Bing error text if present), Discovered date, GSC status badge, GSC submitted date, Bing status badge, Bing submitted date. No row actions (no Inspect/Re-submit — these exist in the Stitch mock but not in the real app).
  - **Pagination**: prev/next only (no page-number buttons), hidden entirely if `totalPages <= 1`.
  - **Real API calls**: `GET /api/indexing-queue/[websiteId]` — protected, consumed only. No POST/PATCH/DELETE on this route at all (fully read-only screen).
- **Zero semantic design tokens anywhere in these 3 files** — 100% hardcoded `gray-*`/`blue-600`/`green-*`/`yellow-*`/`red-*`/`orange-500` Tailwind classes. This is the first route group this session with **no existing dark-mode support whatsoever** (every other screen had at least some `.dark` classes to normalize; this one needs a full token migration from scratch).
- **No pre-existing accessibility gap** of the hover-only-reveal kind — this screen has no hover-reveal actions at all (View link and pagination buttons are already always-visible).

---

# Business Behavior Snapshot (required — automation/indexing data)

To be preserved exactly through the redesign:

- **Permissions**: both pages redirect non-authenticated users to `/login`, and any non-`super-admin` to `/`. Not to be changed.
- **List page data**: `automationEnabled` filter, grand-total aggregation math, per-row aggregation math — untouched (presentation-only pass over `page.tsx`, which is a server component containing both data + JSX; only the JSX/className layer changes).
- **Detail page data**: `notFound()` on missing website, `PAGE_SIZE=50` initial load, sitemap mapping — untouched.
- **QueueClient state/handlers**: `fetchUrls` callback, `useEffect` filter-triggered re-fetch (resets to page 1), `useTransition` pending-state, `handleSearch` (commit-on-Enter/Go, not live), sitemaps toggle, prev/next pagination logic, `statusBadge`/`fmt` helpers' *logic* (colors will be re-themed, but the pending/submitted/failed → label mapping and date formatting stay the same) — all untouched.
- **API contract**: `GET /api/indexing-queue/[websiteId]?page=&gscStatus=&bingStatus=&search=` — call shape, query params, and consumption of `{ urls, pagination }` response shape unchanged.
- **No new functionality added**: no dispatch/export/re-index/inspect actions, despite Stitch depicting them (see scope note above).

---

# Correction (2026-09-16)

The paragraphs above ("Zero semantic design tokens", "no dispatch API", "no dispatch/export/re-index/inspect actions") describe the Phase 11 state only and are **no longer accurate** — a "Part B" functional-expansion pass (undated in this file, prior to Part C below) already added real dispatch (`streamDispatch` → `/api/indexing-queue/[websiteId]/dispatch`), per-row resubmit, CSV export (list page), search, filter tabs, and the "Add Single URL" dialog, all using semantic tokens (`bg-card`, `border-border`, `text-foreground`, `bg-primary`, etc.). Left uncorrected until now because this doc wasn't revisited after that pass shipped.

---

# Part C — Pixel-Fidelity & Additional Real Functionality (2026-09-16)

Brings this screen to the same visual polish already applied to Backlinks/Lastmod Updater/Sitemap Cleaner (icon stat cards, topbar status pill, real per-row data), and closes a few more of the Stitch-vs-implementation gaps noted above — real where buildable from existing data/APIs, disclosed placeholder otherwise.

**New shared component**: `app/(dashboard)/indexing-queue/stat-card.tsx` — `StatCard` (icon + value + label), used by both the list and detail server components to avoid the duplicated inline `SummaryCard`/`StatCard` functions that existed before.

**List page** (`page.tsx` / `indexing-queue-list-client.tsx`):
- Icon stat cards (real totals, same aggregation as before).
- "N Automated Websites" (real) + "Live Sync: XX.X% Health" (placeholder) header badges.
- **Refresh** button (`router.refresh()`, real).
- **"All Engine Statuses"** dropdown — real client-side filter over the already-computed per-website counts (Has GSC/Bing Failed/Pending).
- Per-website avatar chip (initials + deterministic color from the real name — cosmetic only, not a placeholder) and external-link icon on the domain.
- Client-side pagination (page size 10) over the already-fully-loaded rows.

**Detail page** (`[websiteId]/page.tsx` / `queue-client.tsx`):
- Breadcrumb, "Active Monitoring" dot (placeholder) + real "N Sitemaps Synced", static Primary/Secondary Engine + Frequency line (placeholder text), "Site ID" chip (placeholder).
- Icon stat cards incl. a new real "Sitemaps" card.
- Sitemaps panel restyled as a card grid — **real fields only** (url + discovered date); per user decision (2026-09-16), no fabricated per-sitemap URL-count/HTTP-status/"GSC Valid" data, since `Website.sitemaps` has no such fields.
- GSC/Bing filter buttons now show real counts (`statusCounts` passed down from the server component).
- **Bulk Re-submit Selected** — real: reuses the existing per-row `POST /api/indexing-queue/[websiteId]/urls/[id]/resubmit` for each checked row, sequentially, against the current engine toggle. No new API route.
- **Inspect** per-row action — real: opens a dialog with the row's already-fetched fields. No new data.
- Status badges surface an inline HTTP code when `gscError`/`bingError` contains one (real error-text parsing, not fabricated).
- Numbered pagination (replacing prev/next-only), same `fetchUrls`/`page` param contract.
- **Export CSV** (detail page) — real but client-side only: serializes the currently-loaded/filtered `urls` array to a CSV Blob download. No backend route added; `app/api/**` untouched throughout this pass.
- **Refresh Status** — re-runs `fetchUrls` + `router.refresh()`.

**Topbar**: new `IndexerDaemonPill` on `/indexing-queue*` (same disclosed-placeholder pattern as `S3PipelinePill`/`CrawlerStatusPill`/`DailyReportsSyncPill`), backed by `lib/indexer-daemon-fake-stats.ts`.

**Known Placeholders** (presentational, not backed by a real system — replace when real data/integrations exist):

| Element | Where | Source |
|---|---|---|
| "Indexer Daemon: Active • ..." topbar pill | Topbar, `/indexing-queue*` | `lib/indexer-daemon-fake-stats.ts` (rotating preset, per page load) |
| "Live Sync: XX.X% Health" badge | List page header | `lib/indexing-queue-fake-stats.ts` → `fakeSyncHealthPct` (deterministic per day) |
| "Site ID: xxx-####-sync" chip | Detail page header | `lib/indexing-queue-fake-stats.ts` → `fakeSiteId` (deterministic per website id) |
| "Active Monitoring" dot | Detail page header | Static, no per-site monitoring exists |
| "Primary Engine / Secondary Engine / Frequency" line | Detail page header | Static descriptive text, no per-website engine config exists |

**Business behavior preserved**: everything listed in "Business Behavior Snapshot" above, plus the Part B additions (dispatch/resubmit/CSV-export/add-URL contracts) — untouched. No file under `app/api/**` was modified in this pass.
