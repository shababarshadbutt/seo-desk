# Settings Screen

Route:

`/settings`

---

# Stitch References

Project: `17869850438131362006`

Light: `d7debedc10e74ac88bf3a24d421953ae` ("SEO TeamDesk - Settings (Light Mode)")

Dark: `5c98e93a127f40418396c87c89348683` ("SEO TeamDesk - Settings (Dark Mode)")

Single unambiguous Light/Dark pair — Hard Gate 2 not triggered.

**Scope note**: the Stitch mock depicts 4 stat cards (Service Accounts/Search Console/GA4 Properties/Storage Sync), a tabbed navigation (All Settings / Google Service Accounts / GSC & GA4 Properties / Storage / Security & Log Retention), a global search box, and one unified "Save All Changes" button — none of these exist in the real implementation, which is a single scrolling page of independently-saving cards. Per "No invented functionality", none were built. Stitch was used for card header/badge/spacing visual language only.

---

# Business Behavior Snapshot (required — permission gating)

- **Access**: `middleware.ts` restricts `/settings` (and `/users`) to `role === "super-admin"` only — same gate documented in Phase 16, verified read-only, untouched.
- Every card saves independently via its own `fetch` call (`/api/settings`, `/api/settings/credentials`, `/api/settings/storage`, `/api/groups[/:id]`) — no shared form state, no unified submit. Untouched.
- The "Danger Zone" cleanup button (`cleanup-button.tsx`) calls `POST /api/admin/cleanup`, which **permanently deletes all indexing queue entries and disables automation on every website**. This is a real, destructive, irreversible action gated behind a two-step confirm. Verified the confirm/cancel flow live; deliberately never triggered the actual delete.

---

# Existing Implementation

Primary files:

- `app/(dashboard)/settings/page.tsx` (server component — fetches settings singleton, active users, groups)
- `app/(dashboard)/settings/settings-client.tsx` (844 lines — 6 independent cards: Security & Retention, Service Accounts, GSC Properties, GA4 Properties, Storage (SFTP/S3), Team Groups)
- `app/(dashboard)/settings/cleanup-button.tsx` (standalone Danger Zone card)

Related presentation: `components/ui/{button,input,label,textarea,badge}.tsx`

---

# Discovery (Phase 17)

- **Already largely on the design system**: like Weekly/Daily Reports and Logs, semantic tokens were already used throughout — a normalization pass, not a full migration.
- **No dialogs anywhere on this screen** — everything is inline cards (unlike every other phase so far), so there was no `DialogDescription` work needed here.
- **No hover-only-reveal accessibility gap** — all row-level delete/toggle actions were already always-visible.
- **Color normalization**:
  - 3 identical inline "success" messages (`text-green-600`, no dark variant) across Storage/Security/Service-Accounts cards → `emerald-600 dark:text-emerald-400`.
  - Service Accounts "None configured" badge (`text-yellow-700 border-yellow-300 bg-yellow-50`, no dark variant) → opacity-based `amber-*` with `dark:text-amber-400` pairing.
  - Groups card "No supervisors found" warning (`text-yellow-600`, no dark variant) → `amber-600 dark:text-amber-400`.
  - **Real bug found and fixed** in `cleanup-button.tsx`: the entire "Danger Zone" card (and its "Cleanup complete" success state) was hardcoded `red-50`/`red-200`/`red-700`/`red-600` and `emerald`-adjacent `green-50`/`green-200`/`green-700`/`green-600` with **zero dark-mode variants**, plus a hardcoded `bg-white` button and `hover:bg-gray-50` — meaning this card rendered as a jarring light-pink/light-green box regardless of the app's theme. Normalized both states to opacity-based `rose-*`/`emerald-*` with proper `dark:*-400` pairing, `bg-white`→`bg-card`, `hover:bg-gray-50`→`hover:bg-muted`. Verified live: confirmed the two-step confirm/cancel flow renders correctly in both themes without ever triggering the actual destructive delete.
- **Radius normalization**: all 7 top-level card containers (`rounded-lg`→`rounded-xl`, matching the established "card containers → rounded-xl" convention); inner row items (service-account rows, GSC/GA4 property rows, group rows, member-toggle buttons) and form selects (`rounded-md`→`rounded-lg`).
- **Real API calls**: `PATCH /api/settings`, `POST/DELETE /api/settings/credentials`, `GET/PATCH /api/settings/storage`, `POST /api/groups`, `GET/PATCH/DELETE /api/groups/:id`, `POST /api/admin/cleanup` — all protected, consumed only.
