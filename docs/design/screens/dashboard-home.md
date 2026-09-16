# Dashboard Shell Screen

Route:

`/`

---

# Stitch References

Project:

`17869850438131362006`

Light:

`63b0fd25ab46498dba4598c9f0507bee` ("SEO TeamDesk - Overview (Light Mode)")

Dark:

`3ef0ed5c102f44208f810c58f779a49d` ("SEO TeamDesk - Overview (Dark Mode)")

**Note**: no Stitch screen existed for this route (confirmed by re-checking all 43 project screens). Per user decision, generated both Light and Dark designs in Stitch during Phase 3, using a newly-created Stitch design-system asset (`assets/16171290459238422641`) seeded from the tokens already extracted in `docs/design/DESIGN-SYSTEM.md` (blue-600 `#2563eb` primary, Inter, 8px/`rounded-lg` roundness) — chosen specifically to keep this generated screen consistent with the rest of the suite rather than introducing another divergent palette.

No competing candidates — single generated Light/Dark pair. Hard Gate 2 not applicable (nothing pre-existing to disambiguate).

---

# Existing Implementation

Primary file:

`app/(dashboard)/page.tsx`

Related presentation:

- `components/sidebar.tsx`
- `components/topbar.tsx`
- `components/theme-toggle.tsx` (new, from Phase 2)
- `app/globals.css`
- `tailwind.config.ts`

---

# Discovery (Phase 3)

- **Server component** (`app/(dashboard)/page.tsx`): fetches real data server-side via `getServerSession` + MongoDB (`ExecutionLog`, `Backlink`, `ContentTask`, `Group`). Role-based data filtering (`super-admin` sees all, `sub-lead` sees their group, else own data only). Also does a side-effecting stale-run cleanup (`ExecutionLog.updateMany` for interrupted "running" logs) — **this is a business-logic side effect embedded in the page; must not be touched.**
- **Real content, not fiction**: 3 stat sections (Script Executions: Total/Successful/Failed/Running; Backlinks: Total/Live/Pending/Broken; Content Tasks: 4 task types with pending/in-progress/done) + a Recent Script Runs list (last 10). None of this matches the Stitch mockup's fabricated content (fake company names, fake "614 domains", fake API quotas, fake team member activity) — **the Stitch generation invented illustrative content since no real data existed for it to reference. Implementation must restyle the real stat categories/real recent-runs list using the Stitch visual language (KPI card treatment, panel structure, activity-feed row styling), not copy the fictional Stitch content.**
- **`OverviewFilters`** (`app/(dashboard)/overview-filters.tsx`, client component): date-range filter (`from`/`to`) via URL search params, "Apply"/"Clear" buttons — real, working filter, must be preserved exactly.
- **`Sidebar`** (`components/sidebar.tsx`, client component): role-gated nav (`myRank >= minRoleRank`) — items hidden per role (`admin`/`sub-lead`/`super-admin`), 2 collapsible "group" nav items (Content Request / Content Update) with children, active-state highlighting, session-based user card + `signOut({ callbackUrl: "/login" })`. **All of this is real navigation/auth-adjacent behavior — must be preserved exactly, restyled only.** Current nav item count (15, role-gated) exceeds what was in the Stitch generation prompt (which didn't know about Content Request/Update groups or Indexing Queue) — implementation must include the full real nav list, not the Stitch mockup's list.
- **`Topbar`** (`components/topbar.tsx`): exists in the codebase but **is not currently rendered anywhere** (`app/(dashboard)/layout.tsx` only renders `Sidebar` + `main`). Confirmed via grep — genuinely dead/unused code today. Stitch reference includes a top bar; wiring it up now is in-scope for this phase (first genuine need, consistent with Phase 1's deferral).
- **`MissedReportGuard`** (`components/missed-report-guard.tsx`, protected, rendered in layout): not touched.
- **No search, no notifications system exist** in the app — Stitch mockup's search bar (⌘K) and notification bell have no backing capability → omit, per no-invented-functionality rule (same call as Login's SSO buttons).
- **Layout** (`app/(dashboard)/layout.tsx`): `flex h-screen overflow-hidden bg-background` + `Sidebar` + scrollable `main`. This is the real `AppShell`/`PageContainer` candidate structure.
- **Pre-existing responsive defect confirmed at 390×844 baseline**: `Sidebar` is a hardcoded `w-64` fixed-width column with **no mobile behavior at all** (no collapse, no drawer, no hamburger toggle). At mobile width it crushes the main content into a sliver — stat cards clip/wrap badly, numbers get cut off. This must be fixed as part of this phase (CLAUDE.md responsive requirements), not just restyled as-is.
- **Fixed during baseline capture (unrelated to this route, carried from Phase 2)**: hydration warning (`suppressHydrationWarning` added to `app/layout.tsx` — was mismatching because `theme=dark` was already in localStorage from Login testing) and a corrupted `.next` dev cache (caused by running `npm run build` while `next dev` was running) — dev server restarted clean, not a code defect.

---

# Part 2 — Dashboard Redesign (2026-09-16)

User supplied a new, much richer Stitch-style mock (light + dark screenshots directly, not via Stitch MCP this time) and asked for the screen to be renamed "Overview" → "Dashboard" (route stays `/`) and rebuilt to match it, adding any missing functionality rather than omitting it, with real MongoDB data everywhere a backing collection exists and disclosed placeholder data only where none does.

## Corrections to Part 1

Two Part 1 "Discovery" claims are now stale and superseded:

- **Topbar is not dead code.** A later phase (see PROGRESS.md "Dashboard Shell — Done") wired it into `app/(dashboard)/layout.tsx`; it has been live since then.
- **Search and notifications now exist.** `GET /api/search` (global search) and `GET /api/notifications` (computed from `ExecutionLog`/`IndexingQueue`, read-only) were added in that same phase. Part 1's "omit, no backing capability" call for these no longer applies.

## What was deliberately not copied literally from the mock

Per the same "restyle real data, don't copy fabricated content" principle as Part 1: the mock's specific numbers (309 domains, 26 specialists, 6,958 backlinks, 1,842 executions, etc.) are illustrative, not targets — every KPI, chart, and table below is wired to a real, live query and will show this deployment's actual counts. Fictional team-member names became real `User` records. The sidebar's static "FAST" badge became the real Indexing Queue pending-backlog count.

## New real data wired

| Widget | Source | Where |
|---|---|---|
| Script Executions KPI (+ trend) | `ExecutionLog` counts + a new current-vs-prior-window comparison | `lib/dashboard-stats.ts: getExecutionTrend` |
| Backlinks Verified KPI + donut | `Backlink` counts (already fetched) | `app/(dashboard)/_dashboard/backlinks-donut.tsx` |
| Managed Domains KPI | `Website` counts/sitemaps + `IndexingQueue` submitted count | `lib/dashboard-stats.ts: getDomainStats` |
| Specialists Velocity KPI | `User`/`DailyReport`, same "active specialist" definition as `/api/daily-reports/stats` | `lib/dashboard-stats.ts: getSpecialistVelocity` |
| Weekly Execution Velocity chart | New `ExecutionLog` aggregation, grouped by day/status | `lib/dashboard-stats.ts: getWeeklyVelocity` |
| GSC/Bing quota bars | Real "used" (today's `IndexingQueue` submissions); limits are documented static constants, not app state | `lib/dashboard-stats.ts: getQuotaUsage` |
| Specialist Leaderboard | New per-user aggregation across `Backlink`/`DailyReport`/`ExecutionLog`, joined with `User` | `lib/dashboard-stats.ts: getSpecialistLeaderboard` |
| Content Operations Pipeline | Existing `ContentTask` counts (already fetched), restyled as segmented bars | `app/(dashboard)/_dashboard/content-pipeline-panel.tsx` |
| Live Operational Stream | Existing "recent runs" query, restyled as a feed | `app/(dashboard)/_dashboard/live-stream-panel.tsx` |
| Sidebar nav badges (Websites/Users/Backlinks/Indexing Queue) | New read-only role-scoped route | `app/api/nav-counts/route.ts` |
| Automation Daemons panel's Indexing Queue backlog line | Real pending-count query | `lib/dashboard-stats.ts: getIndexingBacklog` |
| "+ Quick Automation" / "Run Core Diagnostics" | Real script-run engine — wraps the existing, unmodified `components/script-runner.tsx` (`POST /api/scripts/run`) in a picker dialog | `components/quick-automation-dialog.tsx` |

## New shared primitives (design-system-first, per CLAUDE.md)

- `components/ui/card.tsx` — names the `rounded-xl border bg-card shadow-sm` pattern already copy-pasted throughout the app; only the 9 new Dashboard panels use it so far.
- `components/ui/stat-card.tsx` — promoted superset of the pre-existing `app/(dashboard)/indexing-queue/stat-card.tsx` (icon/label/value/color) plus `delta`/`breakdown`. That file now just re-exports from here so its 2 existing consumers (`indexing-queue/page.tsx`, `indexing-queue/[websiteId]/page.tsx`) are visually unchanged.
- `components/ui/segmented-bar.tsx` — the 3-segment pipeline bars and the 2 quota bars.
- **Follow-up (not done here)**: 3 other local `StatCard` variants still exist in `backlinks-client.tsx`, `weekly-reports-client.tsx`, and `daily-reports/reports-client.tsx`, unmigrated — each has its own extra fields (`tag`, `RichStatCard`, etc.) not needed by this pass, left as-is to avoid touching screens outside this change's scope.

## Known Placeholders

| Element | File | Why it's placeholder | What would make it real |
|---|---|---|---|
| Automation Daemons row status word + "synced"/"idle" wording | `lib/automation-daemons-fake-stats.ts` | No background daemon or health-tracking system exists — Lastmod Updater/Sitemap Cleaner are synchronous, user-triggered processors; only the Vercel cron job (`app/api/cron/daily-automation`) recurs, and it publishes no health signal | A real monitoring/heartbeat integration for those processes |
| Topbar "System Status: Optimal · 99.8% Health" pill | `lib/system-health-fake-stats.ts` | No uptime/health monitoring integration exists | A real APM/uptime integration |
| GSC/Bing quota *limits* (2,000/day, 10,000/day) | `lib/dashboard-stats.ts` (`GSC_DAILY_QUOTA`, `BING_INDEXNOW_DAILY`) | Documented static published API limits, not values the app tracks anywhere — the *used* half of each bar is a real live count | Reading limits from actual GSC/Bing account config, if that becomes available |
| Leaderboard "Active Xm ago" / "Active now" | `lib/dashboard-stats.ts` (`RECENTLY_ACTIVE_WINDOW_MS`) | Derived from a 15-minute-since-last-activity heuristic on real timestamps, not a live presence/websocket system — worded as "Active X ago" rather than a fake "Online" dot for that reason | A real presence/session-heartbeat system |

## Preserved behavior (unchanged, restyled only)

- The stale-`running`-log auto-fix side effect in `page.tsx`.
- `getUserFilter`'s exact role-scoping shape (super-admin=all, sub-lead=group, admin=own).
- `OverviewFilters`' `from`/`to` URL-param contract (new preset buttons compute the same params and push them; no new param was added).
- `POST /api/scripts/run` and `components/script-runner.tsx` — reused as-is by the new Quick Automation dialog, not modified.

## Product decisions (confirmed with user before build)

- Leaderboard renders only for `super-admin`/`sub-lead` (where it has >1 row); `admin` role sees a compact personal-workload summary card instead, since a role-scoped 1-row "leaderboard" would look broken.
- "Inspect Workload" and "View All N →" both link to `/users` — no per-user-filtered page exists yet, so this is real navigation without a fabricated deep link.
- Sidebar's hardcoded dark-only palette (`bg-[#0b1120]`, slate colors) was fixed as part of this pass — new `--sidebar-*` tokens added to `app/globals.css`/`tailwind.config.ts`, dark mode kept visually identical to before, light mode is now a real light sidebar instead of forced-dark.

## Known issue found and fixed during implementation (not just cosmetic)

`ExecutionLog.userId` is stored as `ObjectId`, unlike `Backlink`/`DailyReport`/`ContentTask` which store it as a plain `String`. `.aggregate()` (unlike `.find()`/`.countDocuments()`) does not auto-cast `$match` values against the schema, so the new Weekly Execution Velocity chart and the leaderboard's execution counts would have silently returned zero for every non-super-admin role. Fixed with a `toExecutionLogMatch()` helper in `lib/dashboard-stats.ts` that casts the relevant `userId` value(s) to `ObjectId` before any `ExecutionLog.aggregate()` call.

## Verification

`npx tsc --noEmit` and `npm run build` both clean after the fix above. Live Playwright browser verification (both themes, 3 breakpoints, date presets, Quick Automation run, leaderboard, sidebar badges) was **not performed this pass** — no test credentials (`E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD`) were available, and the user explicitly chose to skip live verification rather than provide them. This should be run before considering the screen fully "Done" per CLAUDE.md's verification bar.
