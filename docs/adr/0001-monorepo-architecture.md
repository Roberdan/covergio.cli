# ADR 0001: Monorepo Architecture

**Date**: 2026-02-22  
**Status**: Accepted

## Context

Convergio CLI requires unified tooling for CLI workflows, VS Code integration, web dashboards, and agentic orchestration. Early development used separate repos causing sync issues and duplicated code. Need cohesive architecture supporting multiple deployment targets while maintaining shared runtime logic.

## Decision

Adopt monorepo structure with 4 packages managed via npm workspaces:

### Package Structure

- **`packages/core`**: Runtime engine, agent system, tool registry, MCP server implementation
- **`packages/cli`**: Ink-based TUI for terminal usage
- **`packages/vscode-ide-companion`**: VS Code extension for in-editor workflows
- **`packages/web`**: SvelteKit 2 dashboard with SSE real-time updates

### Build System

- **Bundler**: esbuild via `esbuild.config.js` at root for fast compilation
- **TypeScript**: Project references in root `tsconfig.json` pointing to all 4 packages
- **Per-package builds**: Each package maintains own `tsconfig.json` extending root config

### Dependency Management

- **npm workspaces**: Single `package-lock.json` at root
- **Hoisting**: Shared dependencies (TypeScript, Vitest, ESLint) hoisted to root
- **Package-specific deps**: Framework deps (Ink, Svelte) remain in package directories

### Testing Strategy

- **Framework**: Vitest 3.2.4 unified across all packages (migrated from mixed Jest/Vitest)
- **Location**: Co-located `*.test.ts` files alongside source
- **Config**: Root `vitest.config.ts` with per-package overrides for environment (node vs jsdom)

### CI/CD Automation

- **Husky hooks**: 
  - `pre-commit`: lint-staged for formatting
  - `pre-push`: typecheck across all packages
  - `commit-msg`: conventional commits validation
- **Quality gates**: Runs `npm run preflight` (build + test + typecheck + lint)

### Agentic Integration

- **CLAUDE.md v2.0.0**: Auto-loaded context for Claude Code sessions
- **`.claude/settings.json`**: Tool allowlist and preferences
- **`.claude/rules/`**: Repository-specific coding rules
- **`AGENTS.md`**: Cross-tool discovery (TaskMaster, GitHub Copilot CLI)
- **`.github/copilot-instructions.md`**: GitHub Copilot workspace instructions

### Web Dashboard

- **Framework**: SvelteKit 2 + Svelte 5 + Tailwind CSS
- **Data source**: Reads plan-db SQLite via better-sqlite3
- **Real-time**: SSE endpoints for live task updates
- **Deployment**: Docker, Vercel, Azure Static Web Apps support

## Consequences

### Positive

- Single source of truth for core logic reduces drift
- Shared tooling configuration (TypeScript, Vitest, ESLint) enforced uniformly
- Agentic workflows benefit from comprehensive context files (CLAUDE.md, AGENTS.md)
- Web dashboard ships independently while consuming core package
- Simplified CI/CD with single test/build pipeline

### Negative

- Increased initial build time (mitigated by esbuild speed)
- Workspace complexity for new contributors (documented in CONTRIBUTING.md)
- TypeScript project references require strict ordering

### Risks

- Must maintain clear package boundaries to avoid circular dependencies
- Web package size controlled via tree-shaking and bundle analysis
- VS Code extension requires separate bundling for VSIX packaging
