<!-- v2.0.0 -->

# Convergio CLI

**Identity**: TypeScript monorepo | SvelteKit + React/Ink | Vitest | Node 20+ | ESM
**Stack**: packages/core (agents, MCP, auth, tools), packages/cli (React/Ink TUI), packages/vscode-ide-companion, packages/web (SvelteKit dashboard)

## Build & Test (NON-NEGOTIABLE)

| Command | Purpose |
|---------|---------|
| `npm run preflight` | Full validation: clean + test + build + typecheck |
| `npm run build` | esbuild bundle to bundle/convergio.js |
| `npm test` | Vitest across all workspaces |
| `npm run typecheck` | tsc --noEmit |
| `npm run lint:ci` | ESLint zero warnings |

## Core Rules

1. Verify before claim — Read file before answering
2. Act, don't suggest — Implement changes
3. Minimum complexity — Only what's requested
4. Max 250 lines/file — Split if exceeds
5. Proof required — "done" = tested + committed
6. No any types — Use unknown + type narrowing
7. Tests first — Write test, then implementation

## Coding Standards

**TS/JS**: ESLint+Prettier, semicolons, single quotes, max 100 chars, const>let, interface>type, named imports, no default exports. Colocated .test.ts, AAA pattern.
**React/Ink**: Functional components + hooks, no classes, no useEffect for state sync, composition over inheritance.
**Bash**: set -euo pipefail, quote vars, local in functions.

## Architecture

- Agents: BaseAgent → domain agents (MarkItDown, ImageAltText, TaskMaster)
- Tools: BaseTool → ToolRegistry (grep, edit, shell, MCP, web-search)
- MCP: mcp-client.ts (stdio/SSE/HTTP transports) → DiscoveredMCPTool
- UI: React 19 + Ink 6 (TUI), 23 custom hooks
- Auth: OAuth2 PKCE → JWT → SessionManager → RBAC
- Web: SvelteKit 2 + Svelte 5 + Tailwind CSS + Chart.js

## Git & Quality

Branch: feature/, fix/, chore/ | Conventional commits | Zero debt (no TODO/FIXME/@ts-ignore)
Pre-commit: lint-staged | Pre-push: typecheck | Secrets scanner blocks credentials

@.claude/rules/guardian.md
@.claude/rules/coding-standards.md
