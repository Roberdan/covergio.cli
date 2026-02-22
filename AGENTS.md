# Convergio CLI — Agent Discovery

**v1.0.0** | Global: 65 Claude + 9 Copilot CLI agents | Local: BaseAgent framework

## Global Agents (via ~/.claude)

Available when using Claude Code or Copilot CLI in this repo.

### Copilot CLI Agents

| Agent | Purpose | Model |
|-------|---------|-------|
| @code-reviewer | Security-focused code review | claude-opus-4.6 |
| @compliance-checker | Regulatory compliance verification | claude-opus-4.6-1m |
| @execute | Task executor with TDD + Thor validation | gpt-5.3-codex |
| @planner | Wave/task decomposition from requirements | claude-opus-4.6-1m |
| @prompt | Extract F-xx requirements from user input | claude-opus-4.6 |
| @strategic-planner | High-level roadmap and architecture | claude-opus-4.6-1m |
| @tdd-executor | TDD-enforced task execution | gpt-5.3-codex |
| @validate | Wave/task quality validation (Thor) | claude-opus-4.6 |
| @ecosystem-sync | Cross-repo synchronization | claude-haiku-4.5 |

### Claude Code Agents (65 total, key ones)

| Category | Count | Key Agents |
|----------|-------|------------|
| Leadership & Strategy | 7 | ali (orchestrator), antonio, dan, satya |
| Technical Development | 9 | baccio (architect), rex (fullstack), dario (debugger), luca (security) |
| Business Operations | 11 | amy (CFO), anna (EA), davide (PM), marcello (PM) |
| Core Utility | 11 | thor (quality), strategic-planner, marcus, guardian |
| Compliance & Legal | 5 | elena (legal), dr-enzo (healthcare) |
| Design & UX | 3 | jony (creative), sara (UX/UI) |

### Model Tiering

| Tier | Model | Use Case |
|------|-------|----------|
| Premium | claude-opus-4.6 | Security reviews, requirement extraction, Thor validation |
| Standard | gpt-5.3-codex | Code generation, TDD, refactoring |
| Fast | claude-haiku-4.5 | Exploration, quick fixes, build/test |

## Local Agent Framework (packages/core)

Built-in runtime agents:
- **BaseAgent**: EventEmitter lifecycle (birth → ready → sleeping → death)
- **MarkItDownAgent**: Document conversion (PDF, Word, PPT → Markdown)
- **ImageAltTextAgent**: LLM-powered accessibility alt-text generation
- **AgentFactory**: Create agents from config
- **AgentLifecycleManager**: State management with CircuitBreaker

## Usage in This Repo

For development tasks, use global agents via Claude Code or Copilot CLI:
- Planning: `@planner` or `@strategic-planner`
- Coding: `@execute` or `@tdd-executor`
- Review: `@code-reviewer`
- Validation: `@validate`
