# Convergio CLI v1.0.0

[![Convergio CLI CI](https://github.com/convergio/convergio-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/convergio/convergio-cli/actions/workflows/ci.yml)

![Convergio CLI Screenshot](./docs/assets/convergio-screenshot.png)

This repository contains the **Convergio CLI v1.0.0**, a comprehensive Universal AI Agent Orchestration Platform that transforms any conversation into specialized expert assistance through dynamic multi-agent collaboration, with enterprise-grade performance monitoring, security, and advanced document processing capabilities.

## 🏗️ Architecture

Convergio CLI is built as a monorepo with four integrated packages:

```
convergio.cli/
├── packages/core/                  # Runtime engine, agents, tools, MCP integration
├── packages/cli/                   # Ink-based Terminal UI
├── packages/vscode-ide-companion/  # VS Code extension
├── packages/web/                   # SvelteKit Dashboard (NEW in v1.0.0)
├── CLAUDE.md                       # AI agent instructions
├── AGENTS.md                       # Cross-tool agent discovery
└── docs/adr/                       # Architecture Decision Records
```

## 🚀 Key Features

### Core Platform Capabilities

- **🔄 Agent Lifecycle Management**: Robust agent state management with [advanced error handling and recovery](./docs/core/agent-lifecycle-manager.md)
- **🤖 Multi-Agent Orchestration**: Dynamically create and coordinate specialized AI agents for complex tasks
- **🧠 Intelligent Task Decomposition**: Automatically break down complex requests using Task-Master-AI integration
- **💭 Advanced Memory & Context Engine**: Cross-agent memory sharing with vector database integration
- **🔄 Workflow Management**: Sophisticated multi-step process orchestration with state management
- **🎯 Domain Expertise**: Generate agents with specific knowledge domains and capabilities on-demand

### Performance & Monitoring

- **📊 Enterprise Performance Monitoring**: OpenTelemetry integration with comprehensive metrics collection
- **⚡ Advanced Caching System**: Multi-tier caching with Redis support and intelligent eviction policies
- **🔄 Request Queue Management**: Priority-based queuing with load balancing and circuit breakers
- **📈 Real-time Dashboards**: Grafana-compatible dashboards with customizable widgets and templates
- **🚨 Intelligent Alerting**: Multi-channel alerting (Email, Slack, PagerDuty) with escalation policies
- **📋 Automated Reporting**: Comprehensive reports with runbook management and multiple output formats

### Document Processing & AI Agents

- **📄 MarkItDown Integration**: Advanced document processing and format conversion using Microsoft MarkItDown
- **🖼️ ImageAltText Generation**: LLM-powered descriptive alt-text generation for accessibility
- **📚 Multi-Format Support**: Process PDFs, Word documents, presentations, and images
- **🔍 Content Analysis**: Structured data extraction and semantic content understanding

### Security & Compliance

- **🔐 End-to-End Security**: OAuth 2.0 authentication with role-based access control (RBAC)
- **🛡️ Data Protection**: AES-256 encryption for data at rest and TLS 1.3 for data in transit
- **📝 Audit Logging**: Comprehensive security monitoring with real-time threat detection
- **✅ Compliance Ready**: GDPR, HIPAA, and SOC2 compliance features built-in

### Integration & Extensibility

- **🔗 AutoGen Framework**: Microsoft AutoGen integration for sophisticated agent conversations
- **🎛️ Enhanced CLI Interface**: React + Ink terminal UI with real-time multi-agent display
- **💾 Vector Database**: Semantic search and similarity-based memory retrieval
- **🔧 Advanced Commands**: Slash commands for agent management and domain exploration

## 🌐 Web Dashboard (NEW in v1.0.0)

Modern web interface built with SvelteKit 2 + Svelte 5 + Tailwind CSS:

### Features

- **💬 Chat / Orchestrator**: Conversational interface to Convergio's orchestration engine. Supports `/orchestrate`, `/plan`, `/agents` commands with SSE streaming, agent selector, markdown rendering with code blocks
- **📊 Dashboard Overview**: Real-time system metrics, active agents, and performance charts
- **📋 Plan Management**: Kanban board + table view for task orchestration across 147+ plans
- **🤖 Agent Catalog**: Browse 56+ agents across 8 categories (orchestration, technical, domain, tools, leadership, business, compliance, copilot) with search and filtering
- **📈 Metrics & Charts**: Performance visualization with historical trends
- **⚙️ Settings**: API configuration, theme customization, and system preferences
- **🌙 Dark Mode**: Responsive design with real-time SSE updates

### Quick Start

```bash
cd packages/web
node ../../node_modules/vite/bin/vite.js dev --port 3000
# Visit http://localhost:3000
```

### Deployment

Ready for production deployment:

- **Docker**: `docker build -t convergio-web .`
- **Vercel**: `vercel deploy`
- **Azure Static Web Apps**: GitHub Actions workflow included

## 🔍 Agent Discovery

Convergio provides centralized agent discovery across all AI tools:

- **AGENTS.md**: Catalog of 56+ agents (core engine, Claude Code, Copilot CLI, domain templates, built-in tools)
- **.claude/settings.json**: Claude Code configuration with tool allowlists and model preferences
- **.github/copilot-instructions.md**: GitHub Copilot custom instructions for repository-specific behavior

Agents are organized by category: orchestration, quality assurance, architecture, security, performance, documentation, and utilities.

## 🛡️ Quality Gates

Enterprise-grade quality enforcement with automated checks:

### Pre-commit Hooks (Husky + lint-staged)

- **lint-staged**: Automated formatting and linting on changed files only
- **Secret scanning**: 21 pattern checks for API keys, tokens, and credentials
- **TypeScript validation**: Type checking before commit

### Pre-push Hooks

- **Full typecheck**: Project-wide TypeScript strict mode validation
- **Test suite**: Vitest unified testing across all packages
- **Build verification**: Ensure code compiles successfully

### Commit Message Validation

- **Conventional Commits**: Enforced commit message format (`feat:`, `fix:`, `docs:`, etc.)
- **Automated changelog**: Version management with semantic-release

### CI/CD Pipeline

- GitHub Actions workflows for continuous integration
- Automated testing on multiple Node.js versions
- Security scanning and dependency audits

## 🚀 Quick Start

### Option 1: Easy Setup (Recommended)

1. **Prerequisites:** Ensure you have [Node.js version 18+](https://nodejs.org/en/download) installed.

2. **Clone and Build:**

   ```bash
   git clone https://github.com/convergio/convergio-cli
   cd convergio-cli
   npm install
   npm run build
   ```

3. **Configure Authentication:**

   ```bash
   # Setup API keys for AI providers
   ./setup-auth.sh

   # Verify authentication status
   ./check-auth.sh
   ```

4. **Run Convergio CLI:**

   ```bash
   # Option A: Direct execution
   ./convergio.sh

   # Option B: Global installation (recommended)
   ./install.sh
   # Then run from anywhere:
   convergio
   ```

### Option 2: Quick Commands

```bash
# Show help and available options
./convergio.sh --help

# List available extensions
./convergio.sh --list-extensions

# Execute a prompt directly
./convergio.sh -p "create a hello world file"

# Start interactive mode
./convergio.sh
```

### Option 3: Developer Mode

For development and testing:

```bash
npm run dev        # Development mode with hot reload
npm run test       # Run test suite (Vitest)
npm run typecheck  # TypeScript validation
npm run preflight  # Full quality gate check
```

### Option 4: Web Dashboard

Run the web interface for visual agent management:

```bash
cd packages/web
npm install
npm run dev        # SvelteKit dev server at localhost:5173
npm run build      # Production build
npm run preview    # Preview production build
```

### 🔧 Installation Options

#### Global Installation (Recommended)

```bash
./install.sh
# Choose option 1 for system-wide access
# Then run 'convergio' from anywhere
```

#### Local Installation

```bash
./install.sh
# Choose option 2 for user-only access
# Add ~/.local/bin to PATH if needed
```

#### Manual Run

```bash
# Run directly without installation
./convergio.sh [options...]
```

You are now ready to use the Convergio CLI for enterprise-grade multi-agent AI orchestration!

### 🔐 API Key Configuration

Convergio CLI requires at least one AI provider to function. Use our setup script for easy configuration:

#### Automated Setup (Recommended)

```bash
# Interactive setup wizard
./setup-auth.sh

# Check configuration status
./check-auth.sh
```

#### Manual Configuration

Create a `.gemini/.env` file in your project:

```bash
# Primary Providers (choose at least one)
GEMINI_API_KEY="your_gemini_key"              # Get from: https://aistudio.google.com/app/apikey
ANTHROPIC_API_KEY="your_anthropic_key"        # Get from: https://console.anthropic.com/
OPENAI_API_KEY="your_openai_key"              # Get from: https://platform.openai.com/api-keys

# Optional Providers
PERPLEXITY_API_KEY="your_perplexity_key"      # Research features
MISTRAL_API_KEY="your_mistral_key"            # European AI provider
```

For detailed configuration options and troubleshooting, see the [authentication guide](./docs/cli/authentication.md).

## Dependencies and Libraries

### Core Stack

- **Node.js 20+** with TypeScript for type-safe development
- **React + Ink** for interactive terminal UI
- **SvelteKit 2 + Svelte 5** for web dashboard (v1.0.0)
- **Task-Master-AI** for intelligent task decomposition

### Document Processing

- **markitdown-ts v0.0.4**: Convert PDFs, Word, PowerPoint to Markdown
- **MarkItDownAgent** + **ImageAltTextAgent**: Specialized document processing agents
- Verify installation: `node verify-markitdown-simple.js`

### Performance Stack

- **OpenTelemetry**: Distributed tracing with correlation IDs
- **CacheManager**: Multi-tier caching (Memory + Redis) with LRU/LFU eviction
- **RequestQueue**: Priority-based processing with load balancing
- **CircuitBreaker**: Fault tolerance with automatic recovery
- **MetricsCollector**: Real-time performance metrics and Prometheus export

### Multi-Agent Framework

- **AutoGen Integration**: Microsoft AutoGen for agent conversations
- **Agent Factory**: Dynamic agent creation and lifecycle management
- **Memory Engine**: Cross-agent memory with vector database
- **Security Framework**: OAuth 2.0, RBAC, AES-256 encryption, TLS 1.3
- **Compliance**: GDPR, HIPAA, SOC2 ready

## Examples

### Multi-Agent Development

```sh
cd new-project/
convergio
> Create a Discord bot using specialized agents for FAQ, interaction, and monitoring
```

### Collaborative Code Analysis

```sh
cd convergio-cli
convergio
> Deploy agents to analyze yesterday's changes: git analysis, code review, and impact assessment
```

### Document Processing

```text
> Use MarkItDown agents to process PDFs and create a unified knowledge base
> Deploy ImageAltText agent to generate alt-text for all documentation images
```

### Performance Monitoring

```text
> Set up monitoring: dashboard agents for visualization and alerting for notifications
> Deploy observability agents to analyze traces and generate performance insights
```

See [CLI Commands](./docs/cli/commands.md) and [popular tasks](#popular-tasks) for more examples.

### Next steps

- [Contributing guide](./CONTRIBUTING.md) - Build from source
- [CLI Commands](./docs/cli/commands.md) - Available commands
- [Troubleshooting](./docs/troubleshooting.md) - Common issues
- [Full Documentation](./docs/index.md) - Comprehensive docs
- [Popular tasks](#popular-tasks) - Usage examples

## Popular tasks

### Multi-Agent Development

```text
> Analyze this system: architecture, security, and performance assessment agents
> Implement GitHub issue #123: planning, coding, and testing agents
> Migrate to latest Java: migration planning and execution agents
```

### Document Processing

```text
> Process all PDFs and create a unified knowledge base with MarkItDown agents
> Generate alt-text for all images with ImageAltTextAgent
> Document analysis workflow: extraction, summarization, and knowledge graph agents
```

### Enterprise Automation

```text
> Create slide deck of last 7 days: presentation, data analysis, and git history agents
> Build web app showing top GitHub issues with real-time updates
> Compliance reporting: audit log, access control, and vulnerability assessment agents
```

### Uninstall

Head over to the [Uninstall](docs/Uninstall.md) guide for uninstallation instructions.

## Terms of Service and Privacy Notice

For details on the terms of service and privacy notice applicable to your use of Gemini CLI, see the [Terms of Service and Privacy Notice](./docs/tos-privacy.md).
