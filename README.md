# Errands

- `client/`: React app (Vercel)
- `server/`: Express API (Vercel)
- `docs/`: API docs, diagrams, meeting notes

## Getting started

```bash
cp .env.example .env
cd server && npm install && npm run dev
cd client && npm install && npm run dev
```

Each feature lives in its own folder under `client/src/features/` and `server/src/features/`.
Shared files (`App.jsx`, `app.js`, `schema.prisma`) only get one line per feature.
