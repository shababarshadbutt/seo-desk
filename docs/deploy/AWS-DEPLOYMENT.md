# Production Deployment Guide — AWS

This is the step-by-step guide for shipping the current `main` branch (UI revamp merged in) to AWS. It covers what devops needs to configure, the one-time database migration for the 6 new collections added by the revamp, and where S3/SFTP storage config actually lives.

**Nothing in this deploy changes existing behavior.** The UI revamp was presentation-only, and the only real backend change is 6 brand-new, empty MongoDB collections — no existing collection, field, index, or API contract changed. Prod's current database, S3 bucket, and SFTP config keep working unmodified.

---

## 1. Prerequisites

- AWS account with permission to create/update: ECR repository, ECS cluster/service (or an EC2 instance), IAM roles, and an S3 bucket policy.
- The prod MongoDB connection string (existing Atlas cluster — no new database infra needed).
- An S3 bucket for sitemap storage (existing — this app doesn't create one).
- A domain + TLS termination (ALB / CloudFront, or whatever devops already uses in front of the app).
- Docker installed locally or in CI for the build step.

There is currently **no CI/CD pipeline in this repo** (no `.github/workflows`, no `vercel.json`). Build/push/deploy is a manual devops-driven process until one is added.

---

## 2. Environment variables

Copy `.env.example` → set these in the deploy target's env/secrets config (ECS task definition, Secrets Manager, etc.) — never commit real values.

| Variable | Required | Purpose | Notes |
|---|---|---|---|
| `MONGODB_URI` | **Yes** | Prod MongoDB (Atlas) connection string | App fails to start without it (`lib/mongodb/client.ts`) |
| `NEXTAUTH_SECRET` | **Yes** | Signs NextAuth session/JWT tokens | Generate a strong random value; do not reuse the dev value |
| `NEXTAUTH_URL` | **Yes** | Public URL of the deployed app | e.g. `https://seo-desk.yourdomain.com` |
| `GOOGLE_APPLICATION_CREDENTIALS` | Only if GSC/GA4/Sheets features are used | Path to a service-account JSON file baked into the image or mounted at runtime | |
| `PYTHON_EXECUTABLE` | No | Defaults to `python3` | Dockerfile already installs Python 3 + required pip packages |
| `CRON_SECRET` | **Yes (security)** | Authenticates calls to `/api/cron/daily-automation` | **Without this set, that endpoint has no auth check at all.** Set it and configure whatever calls it (see §7) to send it |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` | Only if not using an IAM role | AWS SDK v3 default credential chain picks these up automatically — no code change either way | Prefer an IAM role attached to the ECS task / EC2 instance instead (see §6) |

**Not env vars:** S3 bucket/region/prefix template and SFTP host/username/password/key are stored in MongoDB (the `Settings` singleton document) and configured through the app itself — see §6.

---

## 3. Build & push the image

The existing root `Dockerfile` already builds the full app (Next.js + the Python scripts it shells out to). No changes needed for AWS.

```bash
# From the repo root
docker build -t seo-desk:<version> .

# Tag and push to ECR
aws ecr get-login-password --region <region> | docker login --username AWS --password-stdin <account-id>.dkr.ecr.<region>.amazonaws.com
docker tag seo-desk:<version> <account-id>.dkr.ecr.<region>.amazonaws.com/seo-desk:<version>
docker push <account-id>.dkr.ecr.<region>.amazonaws.com/seo-desk:<version>
```

---

## 4. Deploy on AWS

### Primary path: ECS / Fargate

- Create (or update) a task definition using the pushed image.
- Container port: `3000`.
- Set the environment variables from §2 on the task definition (use Secrets Manager references for `MONGODB_URI`, `NEXTAUTH_SECRET`, `CRON_SECRET`).
- Attach an IAM task role with the S3 permissions described in §6 if you're using role-based S3 auth (recommended over static keys).
- Health check: `GET /` (the app returns the login page or an authenticated redirect — either is a 200/3xx, confirming the process is up).
- Put an ALB in front for TLS termination and routing.

### Fallback path: EC2 + `docker run`

For a simpler single-box setup:

```bash
docker run -d --name seo-desk -p 3000:3000 --env-file .env.production \
  <account-id>.dkr.ecr.<region>.amazonaws.com/seo-desk:<version>
```

Attach the instance's IAM role for S3 access, or fall back to the `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` vars.

---

## 5. Database migration (run once per environment, before cutting traffic)

The revamp added 6 new, currently-empty MongoDB collections: `AuditReview`, `DailyTask`, `ReportMetricsConfig`, `ScriptPreset`, `UserProfile`, `WebsiteProfile`. A migration script creates these collections and their indexes (including the `unique` ones) up front, so the first real requests don't rely on implicit index creation under load.

```bash
# Run from a machine/container that can reach the prod MONGODB_URI
MONGODB_URI="<prod connection string>" npm run migrate
```

This runs [`scripts/migrations/001-ui-revamp-new-collections.ts`](../../scripts/migrations/001-ui-revamp-new-collections.ts). It:

- Only **creates** — never drops or modifies — collections/indexes. Safe to re-run any number of times, in any order relative to deploy.
- Does not touch any existing collection (`User`, `Website`, `Backlink`, `Settings`, etc.).
- Does **not** pre-seed placeholder documents. `UserProfile`, `WebsiteProfile`, and `ReportMetricsConfig` continue to auto-seed a placeholder on first API read, exactly as they already do today — that logic already handles concurrent first-requests safely (`insertMany(..., { ordered: false })` against a unique index).

Run this **before** routing traffic to the new app version, so the unique indexes exist before any concurrent first-reads race to create placeholder docs.

---

## 6. S3 / SFTP configuration

Bucket, region, key prefix template, and SFTP host/credentials are **application-level settings stored in MongoDB**, not environment variables. After deploying and logging in as an admin:

1. Go to **Settings → Storage** in the app (backed by `app/api/settings/storage/route.ts`, `Settings` model's `s3Config`/`sftpConfig` fields).
2. Enter the prod S3 bucket name, region, and key/URL templates (or SFTP host/credentials, whichever source the Lastmod Updater / Sitemap Cleaner features use in this environment).
3. Save — this updates the single `Settings` document in MongoDB immediately, no restart needed.

**What devops *does* need to provision:** whatever AWS credentials the app's process uses to reach that bucket (the SDK doesn't read the bucket name from env — only auth):

- **Recommended:** attach an IAM role (ECS task role or EC2 instance profile) with a bucket policy granting at minimum `s3:ListBucket`, `s3:GetObject`, `s3:PutObject` on the target bucket/prefix. No `AWS_*` env vars needed — the SDK's default credential chain finds the role automatically.
- **Fallback:** set `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` (§2) if no role can be attached.

---

## 7. Cron wiring

`app/api/cron/daily-automation` runs the daily automation job and expects a `CRON_SECRET`-authenticated call. There's no scheduler in this repo — devops needs to provision one, e.g. an **EventBridge Scheduler** rule that calls the endpoint with the `CRON_SECRET` on whatever cadence the automation should run.

---

## 8. Post-deploy verification checklist

- [ ] App responds at the public URL, login page renders.
- [ ] Log in and confirm session/redirect behavior is unchanged.
- [ ] Hit each new API route once and confirm a 200 (not 500) and expected lazy-seed behavior:
  - `GET /api/user-profiles?userIds=<a real user id>`
  - `GET /api/website-profiles?websiteIds=<a real website id>`
  - `GET /api/report-metrics-config`
  - `GET /api/daily-tasks`
  - `GET /api/script-presets`
  - `GET /api/audit-reviews`
- [ ] Open Settings → Storage, confirm S3/SFTP config loaded correctly (this is prod's existing config — untouched by this deploy).
- [ ] Open Lastmod Updater or Sitemap Cleaner and confirm it can list files from S3 (validates the AWS credential path chosen in §6).
- [ ] Confirm no new console/server errors compared to the previous deployed version.

---

## 9. Rollback

Since the DB migration is purely additive, **no database rollback is needed**. Rolling back the app to the previous image tag / task definition revision is sufficient — the old app version simply never queries the 6 new collections, and they remain harmlessly present (and empty, or lazily seeded) in the database.

---

## 10. Known doc debt (not fixed here, flagging for the team)

`README.md` mentions a `docker-compose.yml` "included for running both services locally or on a VPS" — this file does not currently exist in the repo. Worth cleaning up or adding back, separately from this deployment.
