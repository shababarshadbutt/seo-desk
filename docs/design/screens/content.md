# Content Screen

Routes:

`/content?type=landing-request|blog-request|landing-update|blog-publish`

---

# Stitch References

**None exist.** Confirmed via full re-check of the 43-screen Stitch project (Phase 1 audit, re-verified Phase 10). Per user decision (2026-09-15): proceed without generating a Stitch design now — implement using `DESIGN.md`/`DESIGN-SYSTEM.md` conventions and consistency with the 9 already-completed screens (which now constitute a real, established visual reference in their own right). Stitch reference generation for this route is **deferred**, to be revisited later.

---

# Existing Implementation

Primary files:

- `app/(dashboard)/content/page.tsx` (server component — role-based data + redirect-to-default-type)
- `app/(dashboard)/content/content-client.tsx` (filters, stats, table, 3 dialogs, dynamic per-type form)

Related presentation: `components/ui/{button,input,label,badge,dialog,textarea}.tsx`

---

# Discovery (Phase 10)

- **4 sub-types** driven by `?type=` query param (landing-request / blog-request / landing-update / blog-publish), each with a different form-field set (docs link + page URLs; sheet link + blog topics; updated links; published links) and different table "Links" column content. No default route — redirects to `?type=landing-request` if missing/invalid.
- **Role-based**: super-admin/sub-lead see a member filter + all/group records; regular users see only their own, with Add/Edit/Delete.
- **Filters**: member (role-gated), status, date range — client-side filtering (not URL-driven, unlike Backlinks).
- **3 stat cards**: Pending / In Progress / Done — client-computed from filtered rows.
- **Table**: Member (role-gated), Website (+ URL), Date, Status badge, Links (main link + expandable list), actions.
- **3 dialogs**: Add Record, Edit Record, Delete confirm — no accessibility gap here (edit/delete actions are already always-visible, unlike Websites/Backlink Sites/Backlinks).
- **Real API calls**: `POST/PATCH/DELETE /api/content-tasks[/:id]` — protected, consumed only.
- Hardcoded blue/green/yellow colors (StatusBadge, stat cards) — normalizing to primary/emerald/amber per established pattern. `rounded-md` → `rounded-lg`, table container → `rounded-xl`, consistent with all prior phases.
