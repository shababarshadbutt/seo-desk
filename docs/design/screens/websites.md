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

The Stitch mockup invents a much richer table than the real data model supports: fake CMS/framework detection badges, fake "Health Score" percentages, fake "Last Audited"/"Last Crawled" timestamps, bulk-select checkboxes (no bulk-action capability exists), and a top row of 4 fabricated summary stat cards (fake site counts, fake avg health score, fake automation/action-required counts unrelated to real `Website` schema fields). **None of this will be implemented** — same no-invented-functionality/data rule as prior screens. Only the real columns (Website, URL, Assigned Members, Automation badge, row actions) get the Stitch visual treatment (rounded-xl table container, row styling, pill/badge styling, avatar-style member chips).

## Pre-existing responsive defect confirmed at 390×844 baseline

Table wrapper uses `overflow-hidden` (not `overflow-x-auto`), so on mobile the Assigned Members and row-actions columns are **clipped entirely and inaccessible** — not just visually cramped, genuinely unreachable (no horizontal scroll possible). Must fix as part of this phase: change to a horizontally-scrollable container, per CLAUDE.md's "no broken tables" requirement.

## First genuine `DataTable` candidate — decision

Per the plan (Phase 1 §5 / v3 revision "no speculative abstractions"), a shared `DataTable` component is only built when a real, demonstrated pattern exists — not preemptively. This is the *first* table screen. **Decision: restyle this table in place** (not extract a `DataTable` component yet). If Backlinks/Users/Logs (later phases) show the same real pattern repeating, extract `DataTable` at that point and refactor this screen to use it too.
