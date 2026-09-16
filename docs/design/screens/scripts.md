# Scripts Workflow

Routes:

`/scripts` (list), `/scripts/[slug]` (detail / run form)

---

# Stitch References

Project: `17869850438131362006`

Light: `94551d917d02400bbd080cfc9f03558e` ("SEO TeamDesk - Scripts Web Dashboard (Light Mode Refined)")

Dark: `8aef89a413c041449a3352489d8ec22b` ("SEO TeamDesk - Scripts Web Dashboard (Theme Toggle)")

**Hard Gate 2 resolved** (2026-09-15, user decision): Stitch had 7 candidate screens for this route (5 desktop list variants + 2 mobile list variants) which resolved into two near-identical pairs. User selected the above as canonical. Mobile candidates ("Scripts Mobile (Theme Toggle)", "Scripts Mobile Redesign") not used as separate references — mobile handled via responsive CSS on the desktop design, consistent with Login/Dashboard/Websites.

**Re-audited 2026-09-15 (post-Phase-17)**: this doc was left incomplete after Phase 5 (placeholder only, no recorded Stitch-vs-real comparison). Re-opened both canonical screens and re-compared against the current implementation to close the gap before Phase 18.

**Important finding**: all 7 Stitch candidates for this route — including both canonical screens above — are **list-view variants only** (desktop/mobile × light/dark/theme-toggle). **No Stitch screen exists for the `/scripts/[slug]` execution/detail page** (the Inputs-form-plus-terminal view). That page was restyled using the extracted `DESIGN-SYSTEM.md` tokens and the visual language established by the list view, not a literal Stitch reference — the same situation as Content (Phase 10), just never documented as such at the time.

---

# Existing Implementation

Primary files:

- `app/(dashboard)/scripts/page.tsx` (server component — static list from `lib/scripts-config.ts`)
- `app/(dashboard)/scripts/[slug]/page.tsx` (server component — header + `ScriptRunner`)
- `components/script-card.tsx` (list-view card)
- `components/script-runner.tsx` (1010 lines — form inputs, per-site cards for multi-site scripts, single/multi account selectors with search, SSE run/stop, plain-English run-summary translation for URL Indexer)
- `components/terminal-output.tsx` (shared SSE terminal, also used by Lastmod Updater/Sitemap Cleaner)

Protected (consumed only, never touched): `lib/scripts-config.ts`, `asap-scripting/**`, `scripts/**`, `app/api/scripts/run`

---

# Discovery (Phase 5, completed retroactively 2026-09-15)

- **List page**: static grid of `ScriptCard`s from `lib/scripts-config.ts` (currently 8 scripts) — no server/client data fetching, no filtering, no sorting.
- **`ScriptCard`**: icon, name, optional output label, description, input-summary pills (from `script.inputs`, required ones marked with `*`), "Run script" link to the detail page. No category taxonomy field exists on `ScriptConfig`.
- **Detail page (`ScriptRunner`)**: renders an "Inputs" form built dynamically from `script.inputs` (via `ScriptField`), with special-cased UI for multi-site scripts (`SiteCard` per target site — website name, page URLs, per-site run/stop) and account selection (`SingleAccountSelector`/`MultiAccountSelector`, both searchable). Submission streams live output via SSE into `TerminalOutput`, with a plain-English "run summary" translator specifically for the URL Indexer script's raw log output.
- **Real API calls**: `POST /api/scripts/run` (SSE) — protected, consumed only.

## Stitch vs. real — content/feature gaps (list view)

The Stitch mock adds several elements with no backing capability in `lib/scripts-config.ts` or `app/api/scripts/**`:

- **Global search bar** ("Search scripts or target parameters...") — no search implemented; the real page has no query state at all.
- **"Google API Quota" indicator** ("84% Left") — no quota-tracking data exists anywhere in the app.
- **Category filter pills** (All / Indexing / Sitemaps / Analytics) and a **"Sort: Recommended" dropdown** — `ScriptConfig` has no category or ranking field to filter/sort by.
- **"Custom Script" button** — scripts are a hardcoded, protected config list (`lib/scripts-config.ts`); there is no dynamic/custom-script-creation capability, and building one would be a functional change, explicitly out of scope.
- **Per-card 3-dot overflow menu** — no additional per-script actions exist beyond "Run script".
- **Per-card category tag badges** (CRAWLER / GOOGLE API / INSTANT / INDEXING / SITEMAPS / PURGED / DUPLICATE / ANALYTICS) — same root cause as the filter pills, no category field on the real config.

None of the above were built, then or now — confirmed by re-reading the current `page.tsx`/`script-card.tsx`, which contain none of this. This is the correct outcome per "no invented functionality"; the gap was only that it had never been written down.

## Stitch vs. real — detail/execution view

No Stitch screen exists for this state, so there is nothing to compare against directly. The implementation reuses the list view's visual language (card styling, icon-badge header treatment, `rounded-xl` containers) plus the terminal styling already established and documented in `components/terminal-output.tsx`.

---

# Verification (2026-09-15 re-audit)

No code changes were made during this re-audit — it was documentation-only, closing a gap in the paper trail rather than fixing a rendering defect. Confirmed via a quick live check that both `/scripts` and a `/scripts/[slug]` detail route still render cleanly with 0 console errors, consistent with Phase 5's original sign-off.
