# Technology Stack

## Core Technologies

- **Runtime**: Node.js 20+ (ES Modules)
- **Language**: TypeScript 5.3+ with strict mode
- **Build System**: ESBuild for bundling, custom build scripts
- **Package Manager**: npm with workspaces
- **Testing**: Vitest with coverage
- **Linting**: ESLint 9+ with TypeScript ESLint
- **Formatting**: Prettier

## Key Dependencies

### CLI Package
- **UI Framework**: React 19+ with Ink for terminal interfaces
- **CLI Utilities**: yargs, command-exists, shell-quote
- **Highlighting**: highlight.js, lowlight for syntax highlighting

### Core Package  
- **AI Integration**: @google/genai for Gemini API
- **MCP Support**: @modelcontextprotocol/sdk for tool integration
- **Authentication**: google-auth-library for OAuth2
- **Telemetry**: OpenTelemetry SDK for observability
- **File Operations**: glob, micromatch, ignore for file handling
- **Git Integration**: simple-git for repository operations

## Build Commands

```bash
# Development
npm run start              # Start CLI in development
npm run debug             # Start with debugger
npm run build             # Build main project
npm run build:all         # Build project + sandbox

# Testing
npm run test              # Run all tests
npm run test:ci           # Run tests with coverage
npm run test:e2e          # End-to-end integration tests

# Quality
npm run lint              # ESLint check
npm run lint:fix          # Auto-fix linting issues
npm run format            # Prettier formatting
npm run typecheck         # TypeScript type checking
npm run preflight         # Full quality check pipeline

# Utilities
npm run clean             # Remove generated files
npm run bundle            # Create distribution bundle
```

## Architecture Patterns

- **Monorepo**: npm workspaces with packages/cli and packages/core
- **Modular Tools**: Extensible tool system in packages/core/src/tools/
- **Agent System**: Universal agent orchestration in packages/core/src/universal/
- **ESM First**: Pure ES modules with createRequire for compatibility
- **Strict TypeScript**: Comprehensive type safety with strict compiler options