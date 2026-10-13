# API

Document each endpoint here: method, path, auth required, request body, response.

## Auth

### POST /auth/signup
- Auth required: No
- Body: `{ "email": "sam@example.com", "password": "atleast8chars" }`
- 201: `{ "user": { "id": "uuid", "email": "sam@example.com" } }`
- 400: `{ "errors": { "email"?: "...", "password"?: "..." } }`
- 409: `{ "errors": { "email": "This email is already registered" } }`