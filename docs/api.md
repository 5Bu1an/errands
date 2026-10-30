# API

Document each endpoint here: method, path, auth required, request body, response.

## Auth

### POST /auth/signup
- Auth required: No
- Body: `{ "email": "sam@example.com", "password": "atleast8chars" }`
- 201: `{ "user": { "id": "uuid", "email": "sam@example.com" } }`
- 400: `{ "errors": { "email"?: "...", "password"?: "..." } }`
- 409: `{ "errors": { "email": "This email is already registered" } }`


### POST /auth/login
- Auth required: No
- Body: `{ "email": "...", "password": "..." }`
- 200: `{ "accessToken", "refreshToken", "expiresAt", "user": { "id", "email" } }`
- 400: `{ "error": "Email and password are required" }`
- 401: `{ "error": "Invalid email or password" }`

### POST /auth/logout
- Auth required: Yes (`Authorization: Bearer <accessToken>`)
- 204: no body

### GET /auth/me
- Auth required: Yes
- 200: `{ "user": { "id", "email" } }`
- 401: `{ "error": "Not authenticated" }`

> All protected endpoints return 401 `{ "error": "Not authenticated" }` without a valid token.

## Listings

### POST /listings
- Auth required: Yes
- Ride body: `{ "type": "RIDE", "destination": "Walmart", "time": "2026-10-24T17:30:00Z", "seats": 2, "price"?: 5, "pickupLocation"?: "...", "title"?: "...", "description"?: "..." }`
  - `seats`: whole number from 1 to 6. `price`: $0 or more, defaults to 0. `time` must be in the future.
  - `title` defaults to `"Ride to <destination>"`.
- 201: `{ "listing": { "id", "userId", "type", "title", "description", "pickupLocation", "dropoffText", "time", "availableSeats", "price", "status": "OPEN", "createdAt", "updatedAt" } }`
- 400: `{ "errors": { "<field>": "message" } }`, one entry per invalid field

### Cancel a Listing (US-14)

**Endpoint:** `PATCH /listings/:id/cancel`

**Authentication:** Required (Bearer token)

Cancels a listing owned by the authenticated user by changing its status to `CANCELLED`.

**Success (200):**
```json
{
  "message": "Listing cancelled successfully"
}
```

### PATCH /listings/:id/status (US-08)
- Auth required: Yes (owner of the listing only)
- Body: `{ "status": "REQUESTED" }`
- Allowed moves (forward only): `OPEN → REQUESTED → CONFIRMED → IN_PROGRESS → COMPLETED`, and any non-final status → `CANCELLED`. `COMPLETED` and `CANCELLED` are final.
- 200: `{ "message": "Listing status updated", "status": "REQUESTED" }`
- 400: `{ "error": "Invalid listing ID" }` or `{ "errors": { "status": "Status must be one of ..." } }`
- 403: `{ "error": "You cannot change another user’s listing" }`
- 404: `{ "error": "Listing not found" }`
- 409: `{ "error": "Listing cannot move from <current> to <status>" }`. The status is left unchanged.

> `PATCH /listings/:id/cancel` follows the same rules, so a Completed or Cancelled listing returns 409.

## Requests

### PATCH /requests/:id/status (US-08)
- Auth required: Yes
- Body: `{ "status": "ACCEPTED" }`
- Who can set what: the listing owner can set `ACCEPTED` or `DECLINED`. The requester can set `CANCELLED`.
- Allowed moves (forward only): `PENDING → ACCEPTED | DECLINED | CANCELLED`, `ACCEPTED → CANCELLED`. `DECLINED` and `CANCELLED` are final.
- Requests on a `COMPLETED` or `CANCELLED` listing can't be changed.
- 200: `{ "message": "Request status updated", "status": "ACCEPTED" }`
- 400: `{ "error": "Invalid request ID" }` or `{ "errors": { "status": "Status must be one of ..." } }`
- 403: `{ "error": "You are not allowed to make this change" }`
- 404: `{ "error": "Request not found" }`
- 409: `{ "error": "Request cannot move from <current> to <status>" }`. The status is left unchanged.
