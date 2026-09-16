# Sitemap Cleaner Screen

Route:

`/sitemap-cleaner`

---

# Stitch References

Project:

`17869850438131362006`

Light:

`c4af6b65cefa498c978301e91b8d7235` ("SEO TeamDesk - Sitemap Cleaner (Light Mode)")

Dark:

`4d4cf3e6474f48daa2e8f8bffcefe3fe` ("SEO TeamDesk - Sitemap Cleaner (Dark Mode)")

Single unambiguous Light/Dark pair, confirmed against the full 43-screen project listing. Hard Gate 2 not triggered.

---

# Existing Implementation

Primary files:

- `app/(dashboard)/sitemap-cleaner/page.tsx`
- `app/(dashboard)/sitemap-cleaner/sitemap-cleaner-client.tsx`

Related presentation:

- `components/ui/{button,input,label}.tsx`, `components/terminal-output.tsx`

Protected (consumed only, never touched): `lib/sitemapCleaner/**`, `app/api/sitemap-cleaner/**`

---

# Discovery (Phase 7)

Same architectural family as Lastmod Updater — 3-section single-page flow: **Settings → Source → Output.** No dialogs this time.

- **Settings**: domain (only shown for Upload source — other sources derive domain from selection), URL subfolder for sitemaps (live preview of resulting URL pattern).
- **Source**: 4 tabs — **Upload** (multi-file `.xml` picker, client-side parsed via `DOMParser` + gzip-compressed + uploaded in batches of 20 via `CompressionStream`/`POST /api/sitemap-cleaner/upload-batch`), **SFTP**/**S3** (domain select, `GET domains`, `POST fetch-files`), **From URL** (`POST from-url`).
- **Output**: 2 tabs — Download ZIP / Push to S3, then "Clean Sitemaps" → `POST /api/sitemap-cleaner/run`, **SSE-streamed** into `TerminalOutput` (same pattern as Scripts/Lastmod). Success state shows a download link (ZIP or dupes report) or a list of pushed S3 keys.

## Business Behavior Snapshot (required — protected `lib/sitemapCleaner/**` backs this screen)

- **Inputs**: source tab (upload/sftp/s3/url), upload domain text field, sitemap subfolder text field, file picker (multi `.xml`) or domain select or site URL, output tab (zip/s3).
- **Actions**: switch source tab (resets fetch + run state), fetch/discover files (sftp/s3/url only — upload has no fetch step), client-side batch-parse-and-upload XML files, run clean (SSE stream).
- **API calls**: `GET domains`, `POST fetch-files`, `POST from-url`, `POST upload-batch` (gzip-compressed batches), `POST run` (SSE). All under protected `app/api/sitemap-cleaner/**` — not modified.
- **Client-side XML parsing**: `DOMParser` + `getElementsByTagNameNS("*","loc")` + `sitemapindex` root-tag detection happens **in the browser**, before any network call — this logic must not be touched (it's business logic even though it runs client-side).
- **State machine**: `canRun` requires not-running + domain present + (upload: `fileCount > 0`; else: `hasFetched`).
- **Loading states**: `loadingDomains`, `fetchingFiles`, run `status` (idle/running/success/error), per-batch progress lines during upload (`[INFO] Parsing & uploading batch X/Y...`).
- **Error handling**: page-level `error` banner for fetch/domain-load failures; SSE/upload errors append `[ERROR]` lines and set status to error.
- All of the above must survive the redesign byte-for-byte — only class names change.
