# Environment Configuration

Template: `.env.example` (project root). Validation: `lib/config/env.ts` (web + worker), `ai-service/app/core/config.py` (CV service).

> Next.js loads `.env*` files **only from the project root**. A file such as `app/api/.env` is never read.

## Environments

| `APP_ENV` | Validation | Intended for |
|---|---|---|
| `development` | Lenient; missing integrations disable features with a clear 503 | Local machines |
| `test` | Lenient | Automated tests |
| `staging` | **Strict** (same as production) | Pre-production / preview deployments |
| `production` | **Strict** | Live |

If `APP_ENV` is unset it defaults to `production` when `NODE_ENV=production`, otherwise to `NODE_ENV`. Set it explicitly on every deployment (e.g. Vercel *Preview* → `staging`, *Production* → `production`).

## Variables — web app and worker

| Variable | Required (strict) | Default | Notes |
|---|---|---|---|
| `APP_ENV` | recommended | see above | |
| `APP_URL` | **yes** | — | Public origin, used for CSRF origin checks |
| `ALLOWED_ORIGINS` | no | — | Comma-separated extra origins |
| `LOG_LEVEL` | no | `info` | `debug`\|`info`\|`warn`\|`error` |
| `DATABASE_URL` | **yes** | — | PostgreSQL with `pgvector` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | **yes** | — | |
| `CLERK_SECRET_KEY` | **yes** | — | |
| `DEV_ALLOW_ANON` | must be false | `false` | Startup fails if `true` outside local development |
| `REDIS_URL` | **yes** in queue mode | — | `rediss://` for TLS |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | no | — | Legacy; converted to a `rediss://` URL when `REDIS_URL` is empty |
| `ANALYSIS_EXECUTION_MODE` | no | `queue` | `queue` (worker required) or `inline` |
| `WORKER_CONCURRENCY` | no | `2` | Per worker process |
| `RATE_LIMIT_ENABLED` | no | `true` | |
| `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` | **yes** | — | All three or none |
| `STORAGE_ALLOWED_HOSTS` | no | `res.cloudinary.com,api.cloudinary.com` | Worker download allow-list |
| `AI_SERVICE_URL` | **yes** (https) | — | CV service base URL |
| `AI_SERVICE_TOKEN` | **yes** | — | ≥ 32 chars; same value in the CV service |
| `AI_SERVICE_TIMEOUT_MS` | no | `60000` | |
| `LLM_PROVIDER` | no | inferred | `anthropic`\|`gemini`\|`openai_compatible`\|`none`; inferred from the single key present |
| `LLM_TIMEOUT_MS` | no | `120000` | |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | if provider = anthropic | model `claude-opus-5-5` | |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | if provider = gemini | model `gemini-2.5-flash` | |
| `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `OPENAI_MODEL` | if provider = openai_compatible | — | All three required; no implicit default endpoint |

Without an LLM key, combined reports fail with `LLM_NOT_CONFIGURED` (shown to the user); everything else works.

## Variables — CV service (`ai-service/`)

| Variable | Required (strict) | Notes |
|---|---|---|
| `APP_ENV` | yes | `production`/`staging` make the token mandatory and hide `/docs` |
| `AI_SERVICE_TOKEN` | **yes** | ≥ 32 chars; the service refuses to start without it in strict mode |
| `AI_MAX_UPLOAD_BYTES` | no | default 10 MB |
| `PORT` | platform | Render/most hosts inject it |

## Secrets handling

- Generate the service token: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
- Store secrets in the hosting platform's secret store; never in the repository.
- Rotation: change `AI_SERVICE_TOKEN` in the CV service and the web/worker at the same time (brief 401s otherwise; analyses fail visibly as `CV_AUTH_FAILED`, they are not retried).
- The git history contains no committed credentials (audit SEC-18), so no rotation is required on that basis.

## Test-only

| Variable | Notes |
|---|---|
| `TEST_DATABASE_URL` | Name must contain `test`; the schema is dropped and re-migrated |
| `TEST_REDIS_URL` | Use a separate DB index (e.g. `/1`); it is flushed |
