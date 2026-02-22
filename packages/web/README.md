# Convergio Web Dashboard

Convergio Web Dashboard is the SvelteKit-based UI for plan tracking, agent monitoring, and metrics visualization.

## Quick start

```bash
npm install && npm run dev
```

## Deployment

- Docker: use `packages/web/Dockerfile` and root `docker-compose.yml`
- Vercel: use `packages/web/vercel.json`
- Azure: use `packages/web/staticwebapp.config.json`

## Architecture

SvelteKit + Tailwind CSS + Chart.js + better-sqlite3
