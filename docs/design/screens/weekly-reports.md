# Weekly Reports Screen

Route:

`/weekly-reports`

---

# Stitch References

Project: `17869850438131362006`

Light: `4f441aa530094cd1a237d26bf1c05d29` ("SEO TeamDesk - Weekly Reports (Light Mode)")

Dark: `74e64e71980748468c447a05ac6af73c` ("SEO TeamDesk - Weekly Reports (Dark Mode)")

Single unambiguous Light/Dark pair — Hard Gate 2 not triggered.

**Scope note**: the Stitch mock includes an "Executive Summary" AI button, bar/donut charts, and "Export CSV/PDF" — none of these exist in the current implementation (no charting library in use anywhere in the app, no AI endpoint, no export route for this screen). Per "No invented functionality", none of these were built. Stitch was used for the header/filter-bar/card layout language, color-coded totals, and collapsible member/month section styling only.

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
