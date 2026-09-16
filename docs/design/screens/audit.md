# Website Audit Screen

Route:

`/audit`

---

# Stitch References

Project: `17869850438131362006`

Light: `32d564e40211409e8b964472405ef74d` ("SEO TeamDesk - Website Audit (Light Mode)")

Dark: `ea4c4f85da674f8ea686a140672e9a72` ("SEO TeamDesk - Website Audit (Dark Mode)")

Single unambiguous Light/Dark pair — Hard Gate 2 not triggered.

**Scope note**: the Stitch mock depicts a master-detail layout (audit list on the left, a scored detail panel with compliance-percentage stat cards and a progress bar on the right, "QA Lead" review/approval workflow) — none of this exists in the real implementation, which is a flat card list + view/add/delete dialogs with a simple checked/total count, no scoring, no QA-approval workflow. Per "No invented functionality", none of this was built. Stitch was used for card/badge color language and spacing only.

---

# Existing Implementation

Primary files:

- `app/(dashboard)/audit/page.tsx` (server component — role-based data fetching: checklist points + audit records)
- `app/(dashboard)/audit/audit-client.tsx` (record list, New/View/Delete dialogs, checklist manager dialog with reorderable points)

Related presentation: `components/ui/{button,input,label,textarea,dialog}.tsx`

---

# Discovery (Phase 14)

- **Role-based visibility**: super-admin and sub-lead see filters (member/from/to) and other members' audits; plain "admin" role only sees their own. `canDelete` = super-admin or own submission. Only super-admin sees "Manage Checklist".
- **Checklist-driven audits**: `AuditChecklist` collection defines reorderable global checklist points (heading + description); a new audit snapshots the current points into per-record `results[]` (pointId/heading/checked/details) at submission time — later checklist edits don't retroactively change past audit records.
- **New Audit flow**: website name/URL/date + a checklist walkthrough (checkbox + required details textarea once checked), `POST /api/audit-records`.
- **View flow**: read-only dialog showing checked (with details) vs. unchecked points.
- **Delete flow**: confirm dialog, `DELETE /api/audit-records/:id`.
- **Checklist Manager**: add/edit/delete/reorder checklist points (`POST/PATCH/DELETE /api/audit-checklist[/:id]`, `POST /api/audit-checklist/reorder`) — super-admin only.
- **No pre-existing hover-only-reveal accessibility gap** — view/delete icons on record cards and checklist point rows were already always-visible.
- **Pre-existing gaps found and fixed this phase**:
  - Hardcoded `yellow-*` "no checklist configured" banner → `amber-*` (opacity-based).
  - Hardcoded `blue-500`/`blue-600` external-link and URL-detail link colors → `primary`.
  - Hardcoded `green-200`/`green-50`/`green-600` on the View dialog's "checked" result cards (no dark-mode variant) → `emerald-*` (opacity-based, with `dark:*-400` pairing).
  - `rounded-md` on filter/date inputs and the New Audit date field → `rounded-lg`; all card-style containers (record cards, empty state, per-checklist-item cards in the New Audit form, checked/unchecked result cards in View, checklist-manager point cards, the inline point-edit form) → `rounded-xl`, consistent with the convention from every prior phase.
  - None of the 4 dialogs (New Audit, View Audit, Delete, Manage Checklist) had a `DialogDescription` — added to all 4.
  - Checkbox `border-gray-300` (no dark-mode contrast) → `border-input`.
- **Minor pre-existing responsive quirk observed, not fixed** (out of scope — cosmetic only, nothing clipped or inaccessible): on narrow mobile widths the record-card header row (name + external-link icon + "checked" count pill + view/delete icons) wraps a little awkwardly because it's a single `flex justify-between` row without a mobile-specific stacking rule. Documented here per the standing rule to report, not silently fix, out-of-scope pre-existing issues.
- **Real API calls**: `POST /api/audit-records`, `DELETE /api/audit-records/:id`, `POST/PATCH/DELETE /api/audit-checklist[/:id]`, `POST /api/audit-checklist/reorder` — protected, consumed only.
