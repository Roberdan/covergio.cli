# ADR-0002: Web App with SvelteKit

## Status
Accepted

## Context
Convergio CLI needs a visual dashboard for plan tracking, agent monitoring, and metrics visualization. The CLI is powerful but lacks visual representation of complex data.

## Decision
Build the web dashboard as a new package (packages/web) using SvelteKit 2 + Svelte 5 + Tailwind CSS + Chart.js.

### Why SvelteKit
- **Ecosystem coherence**: convergio/frontend already uses SvelteKit — same patterns, skills transferable
- **Performance**: Compiled output, smaller bundles than React/Next.js
- **Full-stack**: Server routes for API, SSR for initial load, CSR for interactivity
- **Adapter flexibility**: adapter-node (local), adapter-vercel, adapter-static (Azure)

### Alternatives Considered
- **Next.js + React**: More complex, would duplicate React with CLI's Ink, heavier runtime
- **Astro + React**: Limited interactivity for real-time dashboard

## Data Flow
```
SQLite (plan-db) → SvelteKit server routes → Svelte stores → Components
~/.claude/data/dashboard.db ──┐
~/.claude/stats-cache.json ───┤─→ +page.server.ts → load() → $page.data
~/.claude/agents/*.md ────────┘
                                  ↓
                              Svelte stores (plansStore, metricsStore, etc.)
                                  ↓
                              UI Components (charts, tables, kanban)
```

## Deployment
- **Local** (default): `npm run dev` on port 3000, reads local SQLite + agent files
- **Docker**: Multi-stage Dockerfile, mounts ~/.claude as read-only volume
- **Vercel**: adapter-vercel, serverless functions for API routes
- **Azure**: Static Web Apps or App Service with adapter-node

## Security
- Local mode: No authentication (trusted local environment)
- Remote mode: OAuth2 ready (auth guard in (app) layout)
- Security headers in hooks.server.ts
- CSP in svelte.config.js
