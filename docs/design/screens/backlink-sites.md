# Backlink Sites Screen

Route:

`/backlink-sites`

---

# Stitch References

Project:

`17869850438131362006`

Light:

`10f039bd0aba44e6badbc6b5074765a9` ("SEO TeamDesk - Backlink Sites (Light Mode)")

Dark:

`bb0b4f3397f54ad3be1fba7ab83b332d` ("SEO TeamDesk - Backlink Sites (Dark Mode)")

Single unambiguous Light/Dark pair, confirmed against the full 43-screen project listing. Hard Gate 2 not triggered.

---

# Existing Implementation

Primary files:

- `app/(dashboard)/backlink-sites/page.tsx` (server component — role-gated: super-admin/sub-lead only)
- `app/(dashboard)/backlink-sites/backlink-sites-client.tsx` (table, Sheet-based bulk TSV import, 2 dialogs)

Related presentation: `components/ui/{button,input,label,dialog,sheet}.tsx`

---

# Discovery (Phase 8)

- **Table**: URL (external link + "Reusable" badge if applicable), DA (color-coded: green ≥40, yellow ≥20, red below), Spam Score (color-coded inverse), Added By (super-admin only), delete action (role-gated: super-admin or original adder).
- **"Add Sites" Sheet** (right-side panel, reused `Sheet` primitive from Phase 3): sophisticated paste-from-Google-Sheets TSV importer — paste zone captures clipboard TSV, parses into an editable row table (URL/DA/Spam%), inline-editable cells, row removal, then bulk `POST /api/backlink-sites`.
- **"Reusable Sites" dialog**: separate mini add-form (single URL + `reusable: true`) plus a list of currently-reusable sites with per-row "remove from reusable" (`PATCH reusable: false`).
- **Delete confirm dialog**: standard pattern.
- **Same pre-existing accessibility gap as Websites (Phase 4)**: 3 separate hover-only-reveal action affordances (table row delete button, reusable-list remove button, TSV-row remove button) all use `opacity-0 group-hover:opacity-100` with no focus/touch fallback — unreachable via keyboard or touch. Fixing all 3 here, same fix as Websites.
- **Real API calls**: `POST/PATCH/DELETE /api/backlink-sites[/:id]` — protected, consumed only.
- Hardcoded `text-blue-600`/`bg-blue-50`/`border-blue-200` in a few spots — normalizing to `text-primary`/token-based per established pattern (same visual result, more maintainable).
