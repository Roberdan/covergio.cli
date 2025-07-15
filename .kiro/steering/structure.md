# Project Structure

## Monorepo Organization

```
├── packages/
│   ├── cli/                    # User-facing CLI interface
│   │   ├── src/
│   │   │   ├── ui/            # React/Ink terminal components
│   │   │   ├── config/        # CLI configuration management
│   │   │   ├── services/      # CLI-specific services
│   │   │   └── utils/         # CLI utilities
│   │   └── dist/              # Built CLI package
│   │
│   ├── core/                   # Backend orchestration engine
│   │   ├── src/
│   │   │   ├── core/          # Main orchestration logic
│   │   │   ├── tools/         # Extensible tool system
│   │   │   ├── universal/     # Agent system & orchestration
│   │   │   ├── auth/          # Authentication management
│   │   │   ├── services/      # Core services
│   │   │   └── telemetry/     # Observability
│   │   └── dist/              # Built core package
│   │
│   └── vscode-ide-companion/   # VS Code extension
│
├── bundle/                     # Distribution artifacts
├── docs/                       # Documentation
├── scripts/                    # Build and utility scripts
├── integration-tests/          # End-to-end tests
└── .taskmaster/               # Task management system
```

## Key Directories

### `/packages/cli/src/`
- **ui/**: React components for terminal interface using Ink
- **config/**: Authentication, settings, and extension configuration
- **services/**: Command service and CLI-specific business logic
- **utils/**: CLI utilities, sandbox management, version handling

### `/packages/core/src/`
- **core/**: Gemini API client, conversation management, tool scheduling
- **tools/**: File system, shell, web search, MCP integration, memory tools
- **universal/**: Agent factory, domain agents, orchestration framework
- **auth/**: OAuth2, JWT, session management, authorization
- **services/**: File discovery, Git integration, shared services
- **telemetry/**: OpenTelemetry integration, metrics, logging

### `/docs/`
- **cli/**: CLI-specific documentation (commands, themes, configuration)
- **core/**: Core system documentation (architecture, security, tools)
- **tools/**: Individual tool documentation

## Naming Conventions

- **Files**: kebab-case for TypeScript files (`gemini-chat.ts`)
- **Classes**: PascalCase (`AuthenticationManager`)
- **Functions**: camelCase (`executeCommand`)
- **Constants**: SCREAMING_SNAKE_CASE (`API_BASE_URL`)
- **Interfaces**: PascalCase with descriptive names (`ToolExecutionContext`)

## Import Patterns

- Use ES modules exclusively (`import`/`export`)
- Relative imports within packages (`./config/auth`)
- Package imports for cross-package dependencies (`@convergio/convergio-cli-core`)
- No relative cross-package imports (enforced by ESLint rule)

## File Organization

- **Tests**: Co-located with source files (`.test.ts` suffix)
- **Types**: Defined in dedicated `types.ts` files or inline
- **Configs**: Root-level configuration files
- **Assets**: Static files in `bundle/` for distribution