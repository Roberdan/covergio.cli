# Convergio CLI

[![Convergio CLI CI](https://github.com/convergio/convergio-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/convergio/convergio-cli/actions/workflows/ci.yml)

![Convergio CLI Screenshot](./docs/assets/convergio-screenshot.png)

This repository contains the **Convergio CLI**, a comprehensive Universal AI Agent Orchestration Platform that transforms any conversation into specialized expert assistance through dynamic multi-agent collaboration, with enterprise-grade performance monitoring, security, and advanced document processing capabilities.

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
npm run test       # Run test suite
npm run typecheck  # TypeScript validation
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

### Core Dependencies

Convergio CLI is built on several key technologies and libraries:

- **Node.js 20+**: Runtime environment for the CLI and agent orchestration
- **TypeScript**: Type-safe development and enhanced developer experience
- **React + Ink**: Terminal UI components for interactive CLI experience
- **Task-Master-AI**: Intelligent task decomposition and management system

### Document Processing

#### MarkItDown Integration

Convergio CLI includes **MarkItDown** integration for advanced document processing and analysis:

- **Library**: `markitdown-ts` v0.0.4 (TypeScript port of Microsoft's MarkItDown)
- **Purpose**: Convert various document formats to Markdown for LLM processing
- **Repository**: [microsoft/markitdown](https://github.com/microsoft/markitdown) (original Python)
- **TypeScript Port**: [markitdown-ts](https://www.npmjs.com/package/markitdown-ts) (Node.js compatible)

**Key Features:**
- Document format conversion (HTML, PDF, Word, etc. to Markdown)
- Image processing and analysis
- Structured content extraction
- LLM-optimized output formatting

**Usage Examples:**
```bash
# Process a document with MarkItDown agent
convergio process document.pdf

# Convert multiple files to Markdown
convergio batch-convert *.docx

# Extract structured data from documents
convergio extract-data presentation.pptx
```

**Agent Integration:**
- **MarkItDownAgent**: Specialized agent for document processing
- **ImageAltTextAgent**: Generate descriptive alt-text for images in documents
- **Memory Integration**: Store processed documents in agent memory for later reference

**Installation Verification:**
To verify the MarkItDown installation is working correctly:
```bash
node verify-markitdown-simple.js          # Simple verification
node scripts/verify-markitdown.js         # Comprehensive verification
npx tsx verify-markitdown.ts              # TypeScript verification
```

### Performance & Monitoring Stack

Convergio CLI includes a comprehensive enterprise-grade performance monitoring and optimization system:

#### Core Performance Components
- **CacheManager**: Multi-tier caching (Memory + Redis) with LRU/LFU eviction policies
- **RequestQueue**: Priority-based request processing with load balancing
- **CircuitBreaker**: Fault tolerance with automatic failure detection and recovery
- **PerformanceManager**: Unified performance orchestration with agent pooling

#### Observability & Metrics
- **OpenTelemetry Integration**: Distributed tracing with correlation IDs
- **MetricsCollector**: Real-time performance metrics with percentile calculations
- **Prometheus Export**: Industry-standard metrics format for monitoring stacks

#### Monitoring & Alerting
- **DashboardManager**: Grafana-compatible dashboards with customizable widgets
- **AlertingManager**: Multi-channel alerting (Email, Slack, PagerDuty, Webhook)
- **ReportingManager**: Automated reports with runbook management
- **Health Monitoring**: Component health tracking with automatic optimization

#### Performance Features
```bash
# Monitor system performance
convergio monitor --dashboard performance    # View performance dashboard
convergio health --detailed                  # Comprehensive health check
convergio metrics --export prometheus        # Export metrics for monitoring

# Performance optimization
convergio cache clear --pattern "expired:*"  # Clear expired cache entries
convergio queue status --show-utilization    # View queue performance
convergio circuit-breaker status             # Check circuit breaker states
```

### Multi-Agent Framework

- **AutoGen Integration**: Microsoft AutoGen for sophisticated agent conversations
- **Agent Factory**: Dynamic agent creation and management system
- **Memory Engine**: Cross-agent memory sharing and context management with vector database
- **Orchestration Engine**: Universal orchestrator for multi-agent workflows with performance optimization
- **Security Framework**: End-to-end encryption and role-based access control
- **Compliance System**: GDPR, HIPAA, and SOC2 compliance features

## Examples

Once the CLI is running, you can start interacting with Convergio's multi-agent system from your shell.

You can start a project from a new directory:

```sh
cd new-project/
convergio
> Create a Discord bot using multiple specialized agents - one for FAQ processing, one for user interaction, and one for monitoring
```

Or work with an existing project:

```sh
git clone https://github.com/convergio/convergio-cli
cd convergio-cli
convergio
> Orchestrate agents to analyze yesterday's changes: one for git analysis, one for code review, and one for impact assessment
```

### Next steps

- Learn how to [contribute to or build from the source](./CONTRIBUTING.md).
- Explore the available **[CLI Commands](./docs/cli/commands.md)**.
- If you encounter any issues, review the **[Troubleshooting guide](./docs/troubleshooting.md)**.
- For more comprehensive documentation, see the [full documentation](./docs/index.md).
- Take a look at some [popular tasks](#popular-tasks) for more inspiration.

### Troubleshooting

Head over to the [troubleshooting](docs/troubleshooting.md) guide if you're
having issues.

## Popular tasks

### Multi-Agent Codebase Analysis

Start by `cd`ing into an existing or newly-cloned repository and running `convergio`.

```text
> Deploy three agents to analyze this system: one for architecture analysis, one for security review, and one for performance assessment.
```

```text
> Create a documentation agent and a code analysis agent to work together on documenting this API.
```

### Collaborative Development

```text
> Orchestrate agents to implement GitHub issue #123: one for planning, one for coding, and one for testing.
```

```text
> Deploy a migration planning agent and execution agent to help migrate this codebase to the latest version of Java.
```

### Document Processing Workflows

Leverage MarkItDown integration for advanced document processing:

```text
> Use MarkItDown agents to process all PDFs in this directory and create a unified knowledge base.
```

```text
> Deploy an ImageAltText agent to generate descriptive alt-text for all images in my documentation.
```

```text
> Create a document analysis workflow: one agent for content extraction, one for summarization, and one for knowledge graph generation.
```

### Performance Monitoring & Optimization

Monitor and optimize system performance with enterprise-grade tools:

```text
> Set up comprehensive monitoring: deploy dashboard agents for performance visualization and alerting agents for real-time notifications.
```

```text
> Create a performance optimization workflow: one agent for cache analysis, one for queue optimization, and one for resource management.
```

```text
> Deploy observability agents to analyze OpenTelemetry traces and generate performance insights with automated recommendations.
```

### Enterprise Automation

Use multi-agent orchestration with comprehensive monitoring:

```text
> Create a presentation agent, data analysis agent, and git history agent to make a slide deck showing the last 7 days of development.
```

```text
> Deploy monitoring agents to create a full-screen web app displaying our most interacted-with GitHub issues with real-time updates.
```

```text
> Orchestrate security agents for compliance reporting: one for audit log analysis, one for access control review, and one for vulnerability assessment.
```

### System Integration

```text
> Coordinate multiple agents to convert all images in this directory to png, with one agent handling conversion and another managing file organization by date.
```

```text
> Use document processing agents to organize my PDF invoices by month of expenditure, with automatic data extraction and categorization.
```

### Uninstall

Head over to the [Uninstall](docs/Uninstall.md) guide for uninstallation instructions.

## Terms of Service and Privacy Notice

For details on the terms of service and privacy notice applicable to your use of Gemini CLI, see the [Terms of Service and Privacy Notice](./docs/tos-privacy.md).
