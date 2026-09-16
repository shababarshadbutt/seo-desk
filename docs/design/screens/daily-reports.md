# Daily Reports Screen

Route:

`/daily-reports`

---

# Stitch References

Project: `17869850438131362006`

Light: `026ec50e4e3c4e88b4beb0d156507f0d` ("SEO TeamDesk - Daily Reports (Light Mode)")

Dark: `8cd6e51571524129a130b9adf7fc85eb` ("SEO TeamDesk - Daily Reports (Dark Mode)")

Single unambiguous Light/Dark pair — Hard Gate 2 not triggered.

**Scope note**: the Stitch mock depicts structured "Today's Tasks" entries with category tags (Content Marketing, Backlink Outreach, etc.), stat cards (Total Submitted Today, Live Backlinks Placed, GSC/Bing Dispatched, RFQs Generated), and a filter-results button — none of these exist in the real implementation, which stores a single freeform report string per day, not structured/tagged tasks, and has no aggregate stat computation for this screen. Per "No invented functionality", none of these were built. Stitch was used for the header/filter-bar layout, member-card visual language (avatar, name, date), and color-coding conventions only.

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
