<!-- v2.0.0 -->
# Coding Standards — Convergio CLI

## TypeScript/JavaScript
ESLint+Prettier | Semicolons | Single quotes | Max 100 chars | const>let | async/await | Named imports | No default exports (unless framework) | interface>type | No any (use unknown + narrowing)

## React/Ink (TUI)
Functional components + hooks only | No classes | No useEffect for state sync | Composition over inheritance | Props above component | Event handlers: handle* prefix

## Testing (Vitest)
Colocated .test.ts | AAA pattern (Arrange/Act/Assert) | vi.mock for ES modules | vi.hoisted for pre-mock setup | beforeEach: vi.resetAllMocks | afterEach: vi.restoreAllMocks | 80% business logic, 100% critical paths

## Bash
set -euo pipefail | Quote all variables | local in functions | trap cleanup EXIT

## Quality
Max 250 lines/file | No TODO/FIXME in committed code | No @ts-ignore | Parameterized queries | CSP headers | Env vars for secrets
