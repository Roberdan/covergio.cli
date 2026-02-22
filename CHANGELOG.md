# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-22

### Added

- **Web Dashboard** (`packages/web/`): Full SvelteKit 2 + Svelte 5 web application with dashboard, plans (kanban+table), agents catalog, metrics charts, settings page. 14 UI components, 8 chart/data components, 7 layout components. Dark mode, responsive design, SSE real-time updates
- **Chat UI** (`/chat`): Convergio Orchestrator chat interface with SSE streaming, conversation management, agent selector, markdown rendering with code blocks and copy. Contextual responses for `/orchestrate`, `/plan`, `/agents` commands. Shows orchestration flow: You → Orchestrator → Agents → Tools → Result
- **Agent Catalog**: 56+ agents across 8 categories (orchestration, technical, domain, tools, leadership, business, compliance, copilot). Core engine agents (UniversalOrchestrator, TaskMaster, AgentFactory), domain templates, 14 built-in tools, 30+ Claude Code agents, 9 Copilot CLI agents
- **Agentic Infrastructure**: CLAUDE.md v2.0.0 (compact format), `.claude/settings.json`, `.claude/rules/` (guardian, coding-standards, compaction-preservation), `AGENTS.md` for cross-tool agent discovery, `.github/copilot-instructions.md`
- **Repository Hardening**: Husky hooks (pre-commit lint-staged, pre-push typecheck, commit-msg conventional commits), `scripts/secret-scanner.sh` (21 patterns), `.github/pull_request_template.md`, ADR directory structure
- **Security Headers**: `hooks.server.ts` with CSP, HSTS, X-Frame-Options, X-Content-Type-Options
- **Deployment Configs**: Dockerfile (multi-stage), docker-compose.yml, vercel.json, staticwebapp.config.json
- **API Endpoints**: 8 REST endpoints (plans, kanban, git-status, test-results, metrics, agents, events SSE)
- **Design System**: Unified CSS variables for colors, spacing, typography, shadows, animations (light+dark)
- **ADRs**: 0001-monorepo-architecture.md, 0002-web-app-sveltekit.md

### Changed

- **CLAUDE.md**: Completely rewritten from 200-line Task Master guide to 49-line compact v2.0.0 format
- **TypeScript**: Replaced `any` types with proper interfaces in UniversalOrchestrator, BaseAgent, UniversalAgentAdapter, autogen types, PythonAutoGenBridge
- **Testing**: Unified Vitest to 3.2.4 across all packages (removed Jest, ts-jest, babel-jest). Consolidated 14 duplicate agent lifecycle test files into 1
- **MCP Client**: Timeout reduced from 10 minutes to 60 seconds, added health checks, retry with exponential backoff (3 retries)
- **Auth Setup**: `setup-auth.sh` now validates API keys before saving (Gemini, OpenAI, Anthropic)
- **Build**: Added TypeScript project references across all 4 packages
- **.gitignore**: Added `.codegraph/` exclusion

### Security

- MCP tool execution: health check before execute, 3-retry exponential backoff
- API key validation in setup-auth.sh
- Secret scanner with 21 patterns (AWS, Azure, GitHub tokens, private keys, etc.)
- Security headers in web app (CSP, HSTS, X-Frame-Options)

### Infrastructure

- New package: `packages/web` (SvelteKit dashboard)
- Root tsconfig.json: project references for core, cli, vscode-ide-companion, web
- npm workspaces: added packages/web
