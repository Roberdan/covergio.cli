/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { randomUUID } from 'crypto';

export interface ToolCall {
  id: string;
  name: string;
  params: Record<string, unknown>;
  status: 'pending' | 'running' | 'complete' | 'error';
  result?: string;
  startedAt?: number;
  completedAt?: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
}

export interface ChatRequest {
  message: string;
  sessionId: string;
  agentId?: string;
  model?: string;
}

export type ChatStreamEvent =
  | { type: 'token'; content: string }
  | { type: 'tool_call'; call: ToolCall }
  | { type: 'done' };

export interface ChatEngine {
  stream(request: ChatRequest): AsyncGenerator<ChatStreamEvent>;
}

const RESPONSE_TEMPLATES: Record<string, string> = {
  orchestrate: `🎯 **Orchestrating multi-agent workflow**\n\nI'm the **UniversalOrchestrator** — Convergio's central brain. Here's what I'm doing:\n\n1. **Analyzing** your request to identify required expertise\n2. **Spawning agents**: TaskMaster (planning), TechnicalSupport (diagnosis), DataAnalysis (metrics)\n3. **Distributing tasks** across agents with priority queues\n4. **Monitoring** via circuit breakers and health checks\n\nAgents available: **56+ specialized agents** across categories:\n- 🏗️ **Orchestration**: UniversalOrchestrator, TaskMaster, AgentFactory\n- 🔧 **Development**: task-executor, tdd-executor, adversarial-debugger\n- 🛡️ **Quality**: thor-quality-assurance-guardian, code-reviewer, validate\n- 📋 **Planning**: planner, strategic-planner, prompt\n- 📊 **Analysis**: DataAnalysisAgent, research-report-generator\n\nEach agent has access to **14 tools**: shell, read-file, write-file, edit, grep, glob, web-search, web-fetch, memory, and MCP protocol.\n\nWhat complex task should I orchestrate?`,

  plan: `📋 **Creating execution plan**\n\nI'm spawning the **TaskMaster agent** to decompose this into waves:\n\n**Wave 1 — Analysis** (parallel)\n- T1-01: Scan codebase structure\n- T1-02: Identify dependencies\n- T1-03: Map test coverage\n\n**Wave 2 — Implementation** (sequential)\n- T2-01: Create migration scripts\n- T2-02: Update configurations\n- T2-03: Write tests (TDD: RED → GREEN → REFACTOR)\n\n**Wave 3 — Validation**\n- T3-01: Thor quality gate (zero tolerance)\n- T3-02: CI/CD verification\n\nPlans are tracked in **plan-db** and visible in the Plans tab. Each task goes through:\n\`pending → in_progress → done\` with per-task Thor validation.\n\nShall I execute this plan? Use \`/execute {plan_id}\` to start.`,

  agents: `🤖 **Agent Catalog** (56+ agents)\n\n**Core Engine** (Gemini-powered):\n- **UniversalOrchestrator** — Routes requests, manages agent pools\n- **TaskMaster** — Decomposes complex tasks into wave-based plans\n- **AgentFactory** — Spawns domain-specific agents on demand\n\n**Claude Code Agents** (30+):\n- **thor-quality-assurance-guardian** — Brutal quality gatekeeper\n- **adversarial-debugger** — 3 parallel agents with competing hypotheses\n- **marcus-context-memory-keeper** — Institutional memory guardian\n- **strategic-planner** — Wave-based parallel execution\n- **app-release-manager** — 5-phase release validation\n\n**Copilot CLI Agents** (9):\n- **@execute** — TDD task execution with drift detection\n- **@validate** — Thor quality gates\n- **@planner** — Wave/task decomposition\n\n**Domain Agents** (auto-created):\n- CustomerService, TechnicalSupport, CreativeAssistant, DataAnalysis\n\n**14 Tools** available to all agents:\nshell, read-file, write-file, edit, grep, glob, web-search, web-fetch, memory, mcp-client, and more.\n\nBrowse the full catalog in the **Agents** tab →`,

  analyze: `🔍 **Spawning analysis agents...**\n\nI'm activating:\n- **code-reviewer** (security-focused, OWASP patterns)\n- **DataAnalysisAgent** (metrics & code health)\n- **socrates-first-principles-reasoning** (architecture review)\n\n**Initial findings** from codebase scan:\n- 📁 4 packages: core, cli, web, vscode-ide-companion\n- 🧪 3,541 tasks tracked, 92% completion rate\n- 🔧 14 tools registered, MCP protocol active\n- 🤖 56+ agents available across 8 categories\n\nThe **Thor quality gate** enforces zero-tolerance on every task. Each agent operates in a sandboxed environment with circuit breakers.\n\nWant me to deep-dive into security, performance, or architecture?`,

  default: `👋 **I'm Convergio** — the Universal AI Agent Orchestration Platform.\n\nI'm not a simple chatbot. I'm an **autonomous multi-agent workforce** powered by Gemini. When you describe a complex task, I:\n\n1. **Analyze** the request and identify required expertise\n2. **Spawn** specialized agents (dev, security, analysis, design)\n3. **Orchestrate** them working in parallel with 14 tools\n4. **Track** progress in wave-based plans with Thor validation\n5. **Deliver** verified results with quality gates\n\n**Try these commands:**\n- \`/orchestrate [task]\` — Multi-agent orchestration\n- \`/plan [task]\` — Create wave-based execution plan\n- \`/agents\` — Browse 56+ specialized agents\n- Ask anything — I'll route to the right agents\n\n**Monitor everything** in the sidebar:\n- 📊 Dashboard — Live metrics\n- 📋 Plans — Track wave/task progress\n- 🤖 Agents — Full catalog\n- 📈 Metrics — Token usage & performance`,
};

const sleep = async (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

function buildToolPrototype(message: string): ToolCall | null {
  const lower = message.toLowerCase();
  if (
    !/(code|file|test|build|api|refactor|fix|bug|script|typescript)/.test(lower)
  )
    return null;
  const candidates: Array<Omit<ToolCall, 'id' | 'status'>> = [
    {
      name: 'read-file',
      params: { path: 'src/routes/api/chat/+server.ts' },
      result: 'Loaded route handler.',
    },
    {
      name: 'shell',
      params: { command: 'npm run test -- chat' },
      result: 'Command simulated with no failures.',
    },
    {
      name: 'edit',
      params: { file: 'src/lib/server/chat-engine.ts' },
      result: 'Prepared minimal patch.',
    },
  ];
  const chosen = candidates[Math.abs(message.length) % candidates.length];
  return { id: randomUUID(), status: 'pending', ...chosen };
}

function selectResponse(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('/orchestrate') || lower.includes('orchestrat'))
    return RESPONSE_TEMPLATES.orchestrate;
  if (
    lower.includes('/plan') ||
    lower.includes('plan') ||
    lower.includes('migrate') ||
    lower.includes('build')
  )
    return RESPONSE_TEMPLATES.plan;
  if (
    lower.includes('/agents') ||
    lower.includes('agent') ||
    lower.includes('list') ||
    lower.includes('catalog')
  )
    return RESPONSE_TEMPLATES.agents;
  if (
    lower.includes('analyz') ||
    lower.includes('audit') ||
    lower.includes('security') ||
    lower.includes('review')
  )
    return RESPONSE_TEMPLATES.analyze;
  return RESPONSE_TEMPLATES.default;
}

class MockChatEngine implements ChatEngine {
  async *stream(request: ChatRequest): AsyncGenerator<ChatStreamEvent> {
    const content = selectResponse(request.message);

    const toolCall = buildToolPrototype(request.message);
    const seed = request.message.length + request.sessionId.length;
    if (toolCall && seed % 2 === 0) {
      yield { type: 'tool_call', call: toolCall };
      await sleep(150);
      yield {
        type: 'tool_call',
        call: { ...toolCall, status: 'running', startedAt: Date.now() },
      };
      await sleep(250);
      yield {
        type: 'tool_call',
        call: { ...toolCall, status: 'complete', completedAt: Date.now() },
      };
    }

    for (const word of content.split(/(\s+)/)) {
      yield { type: 'token', content: word };
      await sleep(25 + Math.random() * 25);
    }
    yield { type: 'done' };
  }
}

class GeminiChatEngine implements ChatEngine {
  async *stream(): AsyncGenerator<ChatStreamEvent> {
    const text =
      'Gemini integration is not configured yet. Falling back to mock engine behavior soon.';
    for (const word of text.split(/\s+/)) {
      yield { type: 'token', content: `${word} ` };
      await sleep(50);
    }
    yield { type: 'done' };
  }
}

export function getChatEngine(
  mode = process.env.CHAT_ENGINE_MODE ?? 'mock',
): ChatEngine {
  return mode === 'real' ? new GeminiChatEngine() : new MockChatEngine();
}
