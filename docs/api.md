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