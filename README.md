# Convergio CLI

[![Convergio CLI CI](https://github.com/convergio/convergio-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/convergio/convergio-cli/actions/workflows/ci.yml)

![Convergio CLI Screenshot](./docs/assets/convergio-screenshot.png)

This repository contains the Convergio CLI, a Universal AI Agent Orchestration Platform that transforms any conversation into specialized expert assistance through dynamic multi-agent collaboration.

With the Convergio CLI you can:

- **Multi-Agent Orchestration**: Dynamically create and coordinate specialized AI agents for complex tasks
- **Domain Expertise**: Generate agents with specific knowledge domains and capabilities on-demand
- **Intelligent Task Decomposition**: Automatically break down complex requests using Task-Master-AI integration
- **Memory & Context Sharing**: Enable agents to share knowledge and maintain conversation context
- **Advanced Document Processing**: Process and analyze documents with specialized MarkItDown agents
- **Automated Workflows**: Orchestrate multi-step processes with agent collaboration patterns

## Quickstart

1. **Prerequisites:** Ensure you have [Node.js version 20](https://nodejs.org/en/download) or higher installed.
2. **Clone and Install:** Clone the repository and install dependencies:

   ```bash
   git clone https://github.com/convergio/convergio-cli
   cd convergio-cli
   npm install
   ```

3. **Build the CLI:**

   ```bash
   npm run build
   ```

   Then, run the CLI:

   ```bash
   npm start
   ```

4. **Configure AI Models:** Set up your preferred AI models and API keys:

   ```bash
   npm run setup
   ```

5. **Initialize Task Management:** Set up Task-Master-AI for intelligent task orchestration:

   ```bash
   npx task-master init
   ```

You are now ready to use the Convergio CLI for multi-agent AI orchestration!

### Configure AI API Keys:

Convergio supports multiple AI providers for maximum flexibility. Configure the providers you want to use:

#### Primary Providers (recommended):

**Anthropic Claude:**
```bash
export ANTHROPIC_API_KEY="your_anthropic_key"
```
Get your key from [Anthropic Console](https://console.anthropic.com/)

**OpenAI GPT:**
```bash
export OPENAI_API_KEY="your_openai_key"
```
Get your key from [OpenAI Platform](https://platform.openai.com/api-keys)

**Google Gemini:**
```bash
export GOOGLE_API_KEY="your_google_key"
# For Vertex AI (optional):
export GOOGLE_GENAI_USE_VERTEXAI=true
```
Get your key from [Google AI Studio](https://aistudio.google.com/apikey)

#### Additional Providers (optional):

**Perplexity (for research features):**
```bash
export PERPLEXITY_API_KEY="your_perplexity_key"
```

**OpenRouter (multiple models):**
```bash
export OPENROUTER_API_KEY="your_openrouter_key"
```

**XAI Grok:**
```bash
export XAI_API_KEY="your_xai_key"
```

**Mistral:**
```bash
export MISTRAL_API_KEY="your_mistral_key"
```

For detailed configuration and model selection, see the [authentication guide](./docs/cli/authentication.md).

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

### Multi-Agent Framework

- **AutoGen Integration**: Microsoft AutoGen for sophisticated agent conversations
- **Agent Factory**: Dynamic agent creation and management system
- **Memory Engine**: Cross-agent memory sharing and context management
- **Orchestration Engine**: Universal orchestrator for multi-agent workflows

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

### Enterprise Automation

Use multi-agent orchestration with MCP servers for complex workflows:

```text
> Create a presentation agent, data analysis agent, and git history agent to make a slide deck showing the last 7 days of development.
```

```text
> Deploy monitoring agents to create a full-screen web app displaying our most interacted-with GitHub issues with real-time updates.
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
