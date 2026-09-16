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

