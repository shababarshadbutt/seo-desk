# Daily Reports Screen

Route:

`/daily-reports`

---

# Stitch References

Project: `17869850438131362006`

Light: `026ec50e4e3c4e88b4beb0d156507f0d` ("SEO TeamDesk - Daily Reports (Light Mode)")

Dark: `8cd6e51571524129a130b9adf7fc85eb` ("SEO TeamDesk - Daily Reports (Dark Mode)")

Single unambiguous Light/Dark pair — Hard Gate 2 not triggered.

**Scope note (superseded — see Part D below)**: the original Part A scope note said the Stitch mock depicted structured "Today's Tasks" entries with category tags, stat cards, and a filter-results button, none of which were built at the time (Part A was presentation-only). Part C built the "Today's Tasks" widget and 4 real stat cards. Part D (below) then discovered the user had a much richer Stitch mock than originally captured, and did a full pixel-fidelity pass to match it.

---

## Part D — Pixel-fidelity redesign (exact Stitch match)

The user shared the actual Stitch Light/Dark screenshots directly (Stitch MCP was disconnected at the time), revealing a much richer design than the original discovery note captured: bigger stat cards with deltas/sub-metrics, per-entry badges/metadata, a category filter with an explicit Filter Results button, and real pagination. Per the user's explicit decisions:
1. **Shell scope**: only the content area was restyled — the shared sidebar/topbar (used by all 16 screens) was intentionally left untouched, so Stitch's different nav grouping, breadcrumb, "Sync Engine" pill, and "Pro Suite" branding were **not** adopted anywhere.
2. **Tagging**: the freeform report stays plain text; the separate "Today's Tasks" widget (Part C) keeps its own tags. No per-bullet-line tag parsing was added.
3. **Fabricated elements**: per explicit instruction ("I need exact like Stitch... if something is not working just make fake and have a list of those we will make them working after initial deployment"), every Stitch element was built for visual parity, using clearly-flagged placeholder values where no real data exists. That list is below — every fake element renders a small muted dot (with a hover tooltip saying "Placeholder — not backed by real data yet") so it's honest in the UI too, not just in this doc.

### Known Placeholders — build real post-deployment

| Element | Where | What real implementation needs |
|---|---|---|
| Live Backlinks "+N% vel." | Stat card | Week-over-week comparison query (compare today's live-backlink count against a trailing 7-day average) |
| Live Backlinks "N% of Quota" | Stat card | A quota concept per member — doesn't exist anywhere; needs a new field + a UI to set it |
| RFQs "+N Passed" | Stat card | A pass/fail concept for RFQs — doesn't exist; needs a new status field on whatever eventually represents an "RFQ form audit" |
| RFQs "Conversion Flow Tested" / "N% Health" | Stat card | A QA/conversion-testing workflow — doesn't exist at all |
| Per-entry job title ("Senior Link Specialist" etc.) | Entry card meta line | A real `title` field on `User` — requires editing the protected `lib/mongodb/models/User.ts` (currently: `lib/daily-report-fake-titles.ts`, a deterministic-per-user placeholder map) |
| Per-entry IP address / Workstation # | Entry card footer | Real request logging on report submission (new, mildly privacy-sensitive capability) — currently: `lib/daily-report-fake-metadata.ts`, deterministic-per-record placeholder |
| Per-entry "Logged in: Xh Ym Shift" | Entry card footer | Session start/end tracking — doesn't exist anywhere in the app (a bigger addition than this screen) — currently: same deterministic placeholder generator |

**Genuinely real** (for contrast — not fabricated, despite visually matching Stitch's "impressive dashboard" density): Total Reports + today's count, Active Specialists Logged + Submission Rate (`User` vs `DailyReport` for the day), Live Backlinks Deployed + Avg/member (`Backlink`), URLs Submitted to Index + Verified Domains (`IndexingQueue`, now shown org-wide to every role as a team-activity preview, not just super-admin), RFQs count (`WeeklyReport.rfqs`), the "Verified Log"/"Archived {date}" badge (derived from the report's own date), the entry's real submission time (`createdAt`), "N Tasks Executed" (real line count of the report text), the Submission ID (the record's own Mongo id), the category filter (real join against Part C's `DailyTask` data), Reset/Filter Results (real pending-filter UX), pagination (real, client-side over the already-fetched list), and the new Export CSV button (`GET /api/daily-reports/export`, new file).

### Files touched
- New: `lib/daily-report-fake-titles.ts`, `lib/daily-report-fake-metadata.ts`, `app/api/daily-reports/export/route.ts`
- Extended (already new-this-session, not protected by the "never modify" rule): `app/api/daily-reports/stats/route.ts` — added `activeSpecialists`, `totalSpecialists`, `submissionRate`, `avgBacklinksPerMember`, `verifiedDomainsHandled`; `gscBingDispatched`/verified-domains now computed org-wide for every role instead of super-admin-only
- Rewritten (not protected): `app/(dashboard)/daily-reports/reports-client.tsx` — stat-card row, entry-card layout, filter bar (pending/apply/reset), pagination. The freeform Add/Edit/Delete dialogs, `MissedReportGuard`, and all real API contracts were not touched.

Verified live: tsc/lint/build clean, protected-file guard clean, real pagination (1,357 real reports → 136 pages of 10), real category filter (correctly returned an empty state for a category with no real `DailyTask` data yet — proving it's a real join, not decoration), real CSV export, 0 console errors across desktop/mobile × Light/Dark, pre-existing Edit-Report dialog re-confirmed working unchanged.

---

# Existing Implementation

Primary files:

- `app/(dashboard)/daily-reports/page.tsx` (server component — role-based data fetching)
- `app/(dashboard)/daily-reports/reports-client.tsx` (report cards, filters, Add/Edit/Delete dialogs, Report Sheet monthly grid dialog)

Related presentation: `components/ui/{button,input,label,textarea,dialog}.tsx`

---

# Discovery (Phase 13)

- **Role-based views**: super-admin and sub-lead see filters (member/from/to) and everyone's reports; regular members only see (and can only manage) their own. `canManage` = super-admin or own row.
- **"Today's report" banner**: shown to non-super-admin viewers who already submitted today — quick-edit shortcut. Was hardcoded `green-*`, normalized to `emerald-*` (opacity-based, matching convention).
- **Add/Edit flow**: single freeform `Textarea` + date picker, `POST`/`PATCH /api/daily-reports[/:id]`.
- **Delete flow**: confirm dialog, `DELETE /api/daily-reports/:id`.
- **Report Sheet**: a separate modal — full-month grid (member rows × day columns), month navigation (can't go past current month), per-cell status glyph (✓ submitted / L leave / PH public holiday / ✗ missing / — future / blank weekend), built from a `Map` lookup over already-loaded `reports`, no additional API call. Visible to everyone except plain "admin" role members (`canSeeMembers`).
- **No pre-existing hover-only-reveal accessibility gap** here — edit/delete icons on report cards were already always-visible, unlike several earlier screens.
- **Pre-existing gaps found and fixed this phase**:
  - Hardcoded `green-*` banner/button colors → `emerald-*`.
  - Report Sheet status glyphs hardcoded `purple-500`/`amber-500`/`green-600`/`red-500` (no dark-mode variants) → added `dark:*-400` pairing consistent with the rest of the app; green→emerald, red→rose (purple kept, since Public Holiday is a genuinely distinct 5th status not covered by the primary/emerald/amber/rose palette).
  - `rounded-md` on filter/date inputs and the report-date field → `rounded-lg`; report cards, empty state, and Report Sheet grid container → `rounded-xl`.
  - None of the 4 dialogs (Add, Edit, Delete, Report Sheet) had a `DialogDescription` — added to all 4, consistent with the app-wide pattern established in Phase 4.
- **Real API calls**: `POST /api/daily-reports`, `PATCH/DELETE /api/daily-reports/:id` — protected, consumed only. Report Sheet reads only from already-fetched `reports` prop, no separate endpoint.
