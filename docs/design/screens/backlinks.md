# Backlinks Tracker Screen

Route:

`/backlinks`

---

# Stitch References

Project:

`17869850438131362006`

Light:

`01da1ea9b2264108a831db439cacf318` ("SEO TeamDesk - Backlinks Tracker (Light Mode)")

Dark:

`28338b6d33714d8c9cb647b8cc1a904d` ("SEO TeamDesk - Backlinks Tracker (Dark Mode)")

Single unambiguous Light/Dark pair, confirmed against the full 43-screen project listing. Hard Gate 2 not triggered.

---

# Existing Implementation

Primary files:

- `app/(dashboard)/backlinks/page.tsx` (server component — heavy role-based data fetching, per-member/per-group aggregation, pagination)
- `app/(dashboard)/backlinks/backlinks-client.tsx` (largest client component yet — member/team dropdown, 5 stat cards, filters, paginated table, 4 dialogs, 2 custom searchable dropdowns)

Related presentation: `components/ui/{button,input,label,badge,dialog}.tsx`

---

# Discovery (Phase 9)

- **Role-based views**: super-admin sees all + member/team dropdown selector + CSV export; sub-lead (supervisor) sees their group + member dropdown; regular user sees only their own, with Add/Edit/Delete access.
- **Member/team dropdown**: custom searchable dropdown (not native select) — "All Members" / per-team groups / per-member, each with live counts.
- **5 stat cards**: Total / Live / Pending / Broken / Pending Review — real counts from server aggregation.
- **Filters**: type, status, approval-status selects + date range — all drive URL search params (server-side filtering + pagination, `PAGE_SIZE=20`).
- **Table**: Website, Backlink URL, Source Site, Type (badge), Review (approval badge — approved/rejected-with-reason/pending/not-reviewed), Member (when applicable), Date, actions (approve/reject for reviewers; edit/delete for own rows only).
- **4 dialogs**: Add Backlink (complex form: target-website select or free text, searchable source-site dropdown with live "already used for this website" check via `GET /api/backlinks/used-sources`, backlink URL, type, date), Edit Backlink, Reject (reason textarea), Delete confirm.
- **Same pre-existing accessibility gap as Websites/Backlink Sites**: edit/delete row actions use `opacity-0 group-hover:opacity-100` — fixing to always-visible, same as prior phases.
- **Real API calls**: `POST/PATCH/DELETE /api/backlinks[/:id]`, `GET /api/backlinks/used-sources`, `GET /api/backlinks/export` (CSV download) — protected, consumed only.
- Hardcoded blue/green/yellow/red/orange colors throughout (StatCard, ApprovalBadge, dropdown highlights) — normalizing to `primary`/emerald/amber/rose per established pattern from prior screens.
