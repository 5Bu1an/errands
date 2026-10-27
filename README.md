# Errands

A campus marketplace for student ride offers and task requests. Students can sign up, post a
listing, view its details, and cancel it.

- `client/`: React + Vite app (deploys to Vercel)
- `server/`: Express + Prisma API backed by Supabase (deploys to Vercel)
- `docs/`: API reference, test plan, traceability matrix, diagrams, meeting notes

## Tech stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, React Router, Vite |
| Backend | Node 20, Express 4, Prisma 5 |
| Auth & DB | Supabase (Postgres + Auth) |
| Tests | Jest 29, Supertest 7 |
| CI | GitHub Actions (`.github/workflows/ci.yml`) |

## Getting started

### 1. Environment

```bash
cp .env.example .env
```

Fill in `.env` with your Supabase project values (`DATABASE_URL`, `DIRECT_URL`,
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEY`). Never commit `.env`.

### 2. Server

```bash
cd server
npm install
npm run db:migrate   # apply Prisma migrations to your database
npm run dev          # API on http://localhost:4000
```

### 3. Client

```bash
cd client
npm install
npm run dev          # app on http://localhost:5173
```

## Running the tests

The backend test suite runs fully offline — Supabase and the database are mocked, so **no
`.env` or network access is needed.**

```bash
cd server
npm install
npm test                 # run all suites
npm test -- --coverage   # run with a coverage report
```

Latest result:

```
Test Suites: 5 passed, 5 total
Tests:       1 todo, 42 passed, 43 total
```

Coverage is ~94% of statements / ~91% of branches across the implemented features.

See [`docs/test-plan.md`](docs/test-plan.md) for the test plan and
[`docs/traceability.md`](docs/traceability.md) for the US-14 acceptance-criteria → test map.

## API

Endpoints are documented in [`docs/api.md`](docs/api.md): sign-up, login, logout, `GET /me`,
create listing, view listing, and cancel listing.

## Project layout

Each feature lives in its own folder under `client/src/features/` and
`server/src/features/`, with its routes, controller, service, and tests together. Shared
files (`App.jsx`, `app.js`, `schema.prisma`) only get one line per feature.

```
server/src/
  app.js                     # registers each feature's routes
  lib/                       # prisma + supabase clients
  middleware/requireAuth.js  # bearer-token auth guard
  features/
    auth/      signup, login, logout, /me  (+ tests)
    listings/  create, view, cancel        (+ tests)
    requests/  (scaffolded)
```

## Branches & workflow

Work is done on `feat/<story>` branches and merged into `main` via pull requests with review.
Recent merged stories: US-1 sign-up, US-2 login, US-3 ride offer, US-9 listing details,
US-14 cancel listing. See the GitHub "Branches" and "Pull requests" tabs for history.
