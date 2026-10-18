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
- Task body: `{ "type": "TASK", "title": "Help moving", "description": "...", "location": "Avila Centre", "time": "2026-10-25T14:00:00Z", "compensation"?: 20 }`
  - `compensation`: $0 or more, defaults to 0. Saved as `price`; `location` is saved as `pickupLocation`.
- 201: `{ "listing": { "id", "userId", "type", "title", "description", "pickupLocation", "dropoffText", "time", "availableSeats", "price", "status": "OPEN", "createdAt", "updatedAt" } }`
- 400: `{ "errors": { "<field>": "message" } }`, one entry per invalid field
