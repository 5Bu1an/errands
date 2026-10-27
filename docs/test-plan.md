# Test Plan

## 1. Scope & objectives

This iteration delivers the backend for the P1 user stories: **sign-up, login/logout,
session auth, creating a listing (ride offer), viewing listing details, and cancelling a
listing**. The goal of testing is to prove each endpoint enforces its acceptance criteria —
validation, authorization, and status transitions — without needing a live database or
Supabase account.

## 2. Approach

| Level | Tool | What it covers |
|-------|------|----------------|
| Unit | Jest | Pure business logic in `service.js` / `controller.js` (e.g. cancel-listing rules, ride validation) |
| Integration (HTTP) | Jest + Supertest | Full route → middleware → controller → service path against the real Express app |

External dependencies are **mocked**, so tests are deterministic and run offline:

- `lib/supabase` (admin client) and `lib/supabasePublic` (login client) → faked with `jest.mock`.
- `lib/prisma` (database) → faked with `jest.mock`.

This lets us drive every branch (success, 400, 401, 403, 404, 409, 500) by controlling what
the fake returns.

## 3. Environment

- Node 20, Jest 29, Supertest 7.
- No `.env`, database, or network access required.
- Same command runs locally and in CI (`.github/workflows/ci.yml`).

## 4. How to run

```bash
cd server
npm install
npm test            # all suites
npm test -- --coverage   # with coverage report
```

## 5. Test inventory

| Suite | File | Tests |
|-------|------|-------|
| Sign-up | `auth/auth.test.js` | 6 |
| Login / logout / requireAuth | `auth/login.test.js` | 10 |
| Create / view listing + cancel (HTTP) | `listings/listings.test.js` | 20 |
| Cancel listing (service logic) | `listings/cancel.test.js` | 6 |
| Requests | `requests/requests.test.js` | placeholder (feature not yet built) |

**Latest run: 42 passing, 1 todo. Statement coverage 94%, branch coverage 91%.**

```
Test Suites: 5 passed, 5 total
Tests:       1 todo, 42 passed, 43 total
```

## 6. Traceability — US-14 "Cancel a listing"

See [`docs/traceability.md`](traceability.md) for the full acceptance-criteria → test map.
Every acceptance criterion for US-14 is covered by at least one automated test.

## 7. Out of scope this iteration

- Client (React) component tests — no UI logic beyond fetch-and-render yet.
- End-to-end tests against a real Supabase project.
- The `requests`, `chat`, `notifications`, `ratings`, and `admin` features (not yet implemented).
