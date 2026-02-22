# Convergio CLI — Copilot Instructions

## Project

TypeScript monorepo (npm workspaces): @covergio/core, @convergio/convergio-cli, convergio-cli-vscode-ide-companion, packages/web (SvelteKit).

## Commands

| Task | Command |
|------|---------|
| Full validation | `npm run preflight` |
| Build | `npm run build` |
| Test | `npm test` |
| Typecheck | `npm run typecheck` |
| Lint | `npm run lint:ci` |
| Dev (web) | `cd packages/web && npm run dev` |

## TypeScript

- Strict mode, ESM (NodeNext), ES2022 target
- Single quotes, semicolons, max 100 chars
- `const` > `let`, `interface` > `type`, no `any`
- Named imports, no default exports (unless framework requires)
- Colocated `.test.ts` files using Vitest

## React/Ink (CLI UI)

- React 19 + Ink 6 for terminal UI
- Functional components + hooks only
- No class components, no useEffect for state sync
- 23 custom hooks in packages/cli/src/ui/hooks/

## SvelteKit (Web Dashboard)

- Svelte 5 runes, SvelteKit 2, Tailwind CSS
- File-based routing with (app) group for protected routes
- Server routes for API (src/routes/api/)
- Stores for client state (src/lib/stores/)

## MCP Integration

- mcp-client.ts supports stdio, SSE, streamable HTTP
- DiscoveredMCPTool extends BaseTool
- Allowlist-based trust model

## Testing (Vitest)

- vi.mock for ES modules, vi.hoisted for pre-mock
- AAA pattern, beforeEach: resetAllMocks
- ink-testing-library for CLI component tests
- @testing-library/react for React components

## Architecture

```
packages/
├── core/     — Agents, tools, MCP, auth, memory, RAG
├── cli/      — React/Ink TUI, hooks, commands
├── vscode-ide-companion/ — VSCode extension (MCP SDK)
└── web/      — SvelteKit dashboard (plans, agents, metrics)
```
