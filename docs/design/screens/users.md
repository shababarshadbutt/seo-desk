# User Management Screen

Route:

`/users`

---

# Stitch References

Project: `17869850438131362006`

Light: `6caf60f04ce64f41943f1566aebacc2e` ("SEO TeamDesk - User Management (Light Mode)")

Dark: `57dce9228dd2485d95f233f89c006ba6` ("SEO TeamDesk - User Management (Dark Mode)")

Bonus states also present in the project (not required to reproduce, noted for completeness): "Invite Team Member Modal" Light `bbb70f5cfdfb4b69a9f7ed09861e6b12` / Dark `669f96af29cc4bf09ef13b3d678c136c`.

Single unambiguous Light/Dark pair for the main screen — Hard Gate 2 not triggered.

**Scope note**: the Stitch mock depicts 4 stat cards (Total Members/Active Seats/Admin & Managers/Deactivated-Pending), a search box, a "Bulk Actions" dropdown, and an "Export Directory" button — none of these exist in the real implementation (no aggregation, no search, no bulk actions, no export route). Per "No invented functionality", none were built. Stitch was used for header/table/badge visual language only.

---

# Existing Implementation

Primary files:

- `app/(dashboard)/users/page.tsx` (server component — fetches all users, no client-side role gate here since access is enforced by `middleware.ts`)
- `app/(dashboard)/users/users-client.tsx` (table, role-change select, activate/deactivate, delete, invite dialog)

Related presentation: `components/ui/{button,input,label,badge,dialog}.tsx`

---

# Business Behavior Snapshot (required — permission gating)

- **Access**: `middleware.ts` restricts `/users` (and `/settings`) to `role === "super-admin"` only — enforced before the page even renders. Confirmed via read-only inspection, not modified.
- **Role hierarchy**: `roleRank` — super-admin=3, sub-lead=2, admin=1, everyone else=0. A viewer can only manage (change role / activate-deactivate) users strictly below their own rank, and never themselves (`canManage = !isSelf && roleRank(target) < myRank`).
- **Delete**: only super-admin can delete, anyone except themselves (`canDelete = !isSelf && myRank === 3`) — including other super-admins.
- **Invite**: role options offered depend on the inviter's own role — a non-super-admin inviter can only create "User" (admin) accounts; super-admin can also create Supervisor (sub-lead) and Admin (super-admin) accounts.
- All of the above logic is untouched by this redesign.

---

# Discovery (Phase 16)

- **Already largely on the design system**: semantic tokens (`bg-card`, `text-muted-foreground`, `text-destructive`, opacity-based role badges) were already in use — a normalization pass, not a full migration.
- **Real pre-existing bug found and fixed**: `new Date(user.createdAt).toLocaleDateString()` had no explicit locale argument, so the server (Node.js default locale) and client (browser locale) rendered different date formats ("23/06/2026" vs "6/23/2026"), causing a full React hydration mismatch and a dev-overlay error on every load. Fixed by passing an explicit `"en-GB"` locale, consistent with date formatting used elsewhere in the app (Daily Reports, Weekly Reports, Website Audit all use explicit locales).
- **Real pre-existing bug found and fixed**: the table wrapper used `overflow-hidden` instead of `overflow-x-auto` — same clipping bug class as Websites/Indexing Queue/Logs, except worse here: the entire Actions column (role-change select, Deactivate/Reactivate, Delete) was completely unreachable on mobile, meaning a super-admin literally could not manage users from a phone. Fixed; confirmed via `scrollWidth`(989)/`clientWidth`(325) that it's now horizontally scrollable.
- **Color normalization**: `RoleBadge`'s "Admin" (super-admin) badge was hardcoded `yellow-*` with no dark-mode pairing → normalized to `amber-*` with `dark:text-amber-400`; "Supervisor" (sub-lead) badge was hardcoded `blue-*` → normalized to `primary` (this app's blue is literally the primary token). "User" badge already used the (now dark-mode-fixed, from Phase 15) shared `Badge` `default`/`success`/`outline` variants — untouched here.
- **InviteForm success panel**: hardcoded `green-50/green-200/green-800/green-700/green-600` with a hardcoded `bg-white` credentials box (would render a white box in dark mode) → normalized to opacity-based `emerald-*` with `dark:*-400` pairing, credentials box → `bg-card`.
- `rounded-md` on the role-change select and invite-role select → `rounded-lg`; table container → `rounded-xl`.
- Neither dialog (Invite, Delete confirm) had a `DialogDescription` — added to both (Delete confirm's existing explanatory paragraph was moved into the description, same dedup pattern as prior phases).
- **No pre-existing hover-only-reveal accessibility gap** — role select/Deactivate/Delete controls were already always-visible (once reachable via the overflow fix).
- **Real API calls**: `POST /api/users`, `PATCH /api/users/:id`, `DELETE /api/users/:id` — protected, consumed only.
