# Traceability Matrix

Links P1 user stories to their acceptance criteria and the automated tests that verify them.
Test IDs reference the `test(...)` name inside the listed file.

## US-14 — Cancel a listing (traced in full)

> **As** a user who posted a listing, **I want** to cancel it, **so that** others no longer
> see it as available.

| # | Acceptance criterion | Verified by | File |
|---|----------------------|-------------|------|
| AC-1 | The owner can cancel their own OPEN listing; status becomes `CANCELLED`. | `owner can cancel an open listing` | `listings/cancel.test.js` |
| AC-2 | A user cannot cancel someone else's listing (403). | `non-owner cannot cancel listing` / `rejects cancellation by a different user` | `listings/cancel.test.js`, `listings/listings.test.js` |
| AC-3 | Cancelling a listing that does not exist returns 404. | `missing listing returns NOT_FOUND` / `returns 404 for a missing listing` | `listings/cancel.test.js`, `listings/listings.test.js` |
| AC-4 | A `COMPLETED` or already-`CANCELLED` listing cannot be cancelled (409). | `cannot cancel a %s listing` / `rejects cancellation of a completed listing` | `listings/cancel.test.js`, `listings/listings.test.js` |
| AC-5 | A malformed listing ID is rejected before any DB call (400). | `rejects an invalid listing ID` | `listings/listings.test.js` |
| AC-6 | Only a logged-in user can cancel (401 otherwise). | Enforced by `requireAuth`, covered by `returns 401 ...` | `auth/login.test.js` |
| AC-7 | A concurrent status change is handled safely (no double-cancel). | `handles concurrent status changes` | `listings/cancel.test.js` |

**Result: all 7 acceptance criteria covered and passing.**

## Other stories (summary coverage)

| Story | Key criteria tested | File |
|-------|---------------------|------|
| US-1 Sign up | valid signup 201, duplicate email 409, invalid email/password 400, Supabase failure 500 | `auth/auth.test.js` |
| US-2 Login / logout | correct creds 200, wrong creds 401, missing fields 400, session-only logout 204 | `auth/login.test.js` |
| US-3 Create ride listing | valid ride 201 OPEN, past date 400, bad seats/price 400, 401 when logged out | `listings/listings.test.js` |
| US-9 View listing details | 200 with details, 404 missing, 400 bad ID, 401 logged out | `listings/listings.test.js` |
