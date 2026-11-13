# Saarthi — Personal Wellness Intelligence Platform

Skin, physical and mental wellness check-ins with computer-vision analysis, rule-based questionnaire reports, an AI-written combined synthesis, and progress tracking.

> Saarthi provides wellness guidance, not medical diagnosis. Every report states how it was produced (computer vision on your photo, a rule-based estimate from your answers, or AI-written narrative), and values that were not measured are shown as "Not measured".

## Components

| Component | Tech | Run |
|---|---|---|
| Web app + API | Next.js 16, React 19, TypeScript, Clerk, Prisma 7 / PostgreSQL | `npm run dev` |
| Analysis worker | BullMQ on Redis (separate process) | `npm run worker` |
| CV service | Python FastAPI, OpenCV, MediaPipe (`ai-service/`) | `docker compose up -d ai` |

## Quick start

```bash
nvm use                       # Node 22
npm install
cp .env.example .env          # fill in at least the Clerk keys
npm run infra:up              # PostgreSQL (pgvector) + Redis via Docker
npm run db:migrate:deploy
npm run dev                   # http://localhost:3000
npm run worker:dev            # second terminal
```

Full setup, commands and conventions: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Documentation

- [Architecture](docs/ARCHITECTURE.md) · [Database](docs/DATABASE_ARCHITECTURE.md) · [Security](docs/SECURITY_ARCHITECTURE.md)
- [API conventions](docs/api/API_CONVENTIONS.md) · [Environment configuration](docs/deployment/ENVIRONMENT_CONFIGURATION.md)
- [Initial audit](docs/audit/INITIAL_AUDIT.md) and findings · [Phase 1 completion report](PHASE_1_COMPLETION_REPORT.md)

## Tests

```bash
npm run test:unit
TEST_DATABASE_URL=postgresql://saarthi:saarthi@localhost:5432/saarthi_test TEST_REDIS_URL=redis://localhost:6379/1 npm run test:integration
npm run ai:test
```
