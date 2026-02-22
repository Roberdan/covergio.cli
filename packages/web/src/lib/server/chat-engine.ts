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

const RESPONSE_TEMPLATES = [
  'I can help with "{message}". I will outline a safe plan, then provide implementation-ready steps.',
  'For this request, I would start by validating assumptions, then make small, testable changes.',
  'Good direction. I can map dependencies, propose edits, and keep the workflow easy to verify.',
  'I can break this into milestones and provide concrete actions you can run immediately.',
  'This is a great candidate for iterative delivery: inspect, implement, validate, and summarize.',
  'I can tackle "{message}" with a minimal-change strategy and clear checkpoints.'
] as const;

const THINKING_PREFIXES = [
  'Thinking through your request now.',
  'Reviewing context and constraints.',
  'Planning the most reliable approach.'
] as const;

const sleep = async (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const pick = <T>(items: readonly T[], seed: number): T =>
  items[Math.abs(seed) % items.length];

function getAgentContext(agentId?: string): string {
  if (!agentId) return 'general assistant';
  const lower = agentId.toLowerCase();
  if (lower.includes('debug')) return 'debugging assistant';
  if (lower.includes('security')) return 'security auditor';
  if (lower.includes('planner')) return 'execution planner';
  if (lower.includes('docs')) return 'documentation specialist';
  return `${agentId} assistant`;
}

function buildToolPrototype(message: string): ToolCall | null {
  const lower = message.toLowerCase();
  if (!/(code|file|test|build|api|refactor|fix|bug|script|typescript)/.test(lower)) return null;
  const candidates: Array<Omit<ToolCall, 'id' | 'status'>> = [
    { name: 'read-file', params: { path: 'src/routes/api/chat/+server.ts' }, result: 'Loaded route handler.' },
    { name: 'shell', params: { command: 'npm run test -- chat' }, result: 'Command simulated with no failures.' },
    { name: 'edit', params: { file: 'src/lib/server/chat-engine.ts' }, result: 'Prepared minimal patch.' }
  ];
  const chosen = pick(candidates, message.length);
  return { id: randomUUID(), status: 'pending', ...chosen };
}

class MockChatEngine implements ChatEngine {
  async *stream(request: ChatRequest): AsyncGenerator<ChatStreamEvent> {
    const seed = request.message.length + request.sessionId.length;
    const agent = getAgentContext(request.agentId);
    const thinking = pick(THINKING_PREFIXES, seed);
    const template = pick(RESPONSE_TEMPLATES, seed).replace('{message}', request.message);
    const content = `${thinking} Acting as a ${agent}, ${template}`;

    const toolCall = buildToolPrototype(request.message);
    if (toolCall && seed % 2 === 0) {
      yield { type: 'tool_call', call: toolCall };
      await sleep(150);
      yield { type: 'tool_call', call: { ...toolCall, status: 'running', startedAt: Date.now() } };
      await sleep(250);
      yield {
        type: 'tool_call',
        call: { ...toolCall, status: 'complete', completedAt: Date.now() }
      };
    }

    for (const word of content.split(/\s+/)) {
      yield { type: 'token', content: `${word} ` };
      await sleep(50);
    }
    yield { type: 'done' };
  }
}

class GeminiChatEngine implements ChatEngine {
  async *stream(): AsyncGenerator<ChatStreamEvent> {
    const text = 'Gemini integration is not configured yet. Falling back to mock engine behavior soon.';
    for (const word of text.split(/\s+/)) {
      yield { type: 'token', content: `${word} ` };
      await sleep(50);
    }
    yield { type: 'done' };
  }
}

export function getChatEngine(mode = process.env.CHAT_ENGINE_MODE ?? 'mock'): ChatEngine {
  return mode === 'real' ? new GeminiChatEngine() : new MockChatEngine();
}
