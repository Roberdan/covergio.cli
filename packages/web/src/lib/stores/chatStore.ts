/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { browser } from '$app/environment';
import { writable, derived, get } from 'svelte/store';
export interface ChatSession {
  id: string;
  title: string;
  agentId: string | null;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  toolCalls?: ToolCall[];
}
export interface ToolCall {
  id: string;
  name: string;
  params: Record<string, unknown>;
  status: 'pending' | 'running' | 'complete' | 'error';
  result?: string;
}
const STORAGE_KEY = 'chat-store';
const TOOL_STATUSES: Array<ToolCall['status']> = ['pending', 'running', 'complete', 'error'];
const sessions = writable<ChatSession[]>([]);
const activeSessionId = writable<string | null>(null);
const isStreaming = writable(false);
const activeSession = derived([sessions, activeSessionId], ([$sessions, $id]) => $sessions.find(s => s.id === $id) ?? null);
const activeMessages = derived(activeSession, $session => $session?.messages ?? []);
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const toString = (value: unknown): string => (typeof value === 'string' ? value : '');
const toNumber = (value: unknown): number => (typeof value === 'number' ? value : Date.now());
function createSession(agentId: string | null = null): string {
  const now = Date.now();
  const session: ChatSession = { id: crypto.randomUUID(), title: 'New Chat', agentId, messages: [], createdAt: now, updatedAt: now };
  sessions.update(list => [session, ...list]);
  activeSessionId.set(session.id);
  return session.id;
}
function updateSession(id: string, updater: (session: ChatSession) => ChatSession): void {
  sessions.update(list => list.map(session => (session.id === id ? updater(session) : session)));
}
function applyAssistantUpdate(sessionId: string, messageId: string, updater: (message: ChatMessage) => ChatMessage): void {
  updateSession(sessionId, session => ({ ...session, updatedAt: Date.now(), messages: session.messages.map(message => (message.id === messageId ? updater(message) : message)) }));
}
function parseToolCall(value: unknown): ToolCall | null {
  if (!isRecord(value)) return null;
  const status = toString(value.status);
  return { id: toString(value.id) || crypto.randomUUID(), name: toString(value.name) || 'tool', params: isRecord(value.params) ? value.params : {}, status: TOOL_STATUSES.includes(status as ToolCall['status']) ? (status as ToolCall['status']) : 'pending', result: typeof value.result === 'string' ? value.result : undefined };
}
function applyStreamEvent(sessionId: string, assistantId: string, eventName: string, data: unknown): void {
  const payload = isRecord(data) ? data : {};
  const type = typeof payload.type === 'string' ? payload.type : eventName;
  if (type === 'token') {
    const token = toString(payload.token ?? payload.content ?? payload.delta ?? payload.text);
    if (token) applyAssistantUpdate(sessionId, assistantId, message => ({ ...message, content: message.content + token }));
    return;
  }
  if (type === 'tool_call') {
    const toolRaw = isRecord(payload.toolCall) ? payload.toolCall : payload;
    const toolCall = parseToolCall(toolRaw);
    if (!toolCall) return;
    applyAssistantUpdate(sessionId, assistantId, message => {
      const calls = message.toolCalls ?? [];
      const index = calls.findIndex(call => call.id === toolCall.id);
      if (index === -1) return { ...message, toolCalls: [...calls, toolCall] };
      const next = [...calls];
      next[index] = { ...next[index], ...toolCall };
      return { ...message, toolCalls: next };
    });
    return;
  }
  if (type === 'done') applyAssistantUpdate(sessionId, assistantId, message => ({ ...message, isStreaming: false }));
}
async function sendMessage(content: string): Promise<void> {
  const text = content.trim();
  if (!text) return;
  const sessionId = get(activeSessionId) ?? createSession();
  const session = get(sessions).find(item => item.id === sessionId);
  if (!session) return;
  const now = Date.now();
  const assistantId = crypto.randomUUID();
  const firstUserMessage = session.messages.every(message => message.role !== 'user');
  const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text, timestamp: now };
  const assistantMessage: ChatMessage = { id: assistantId, role: 'assistant', content: '', timestamp: now, isStreaming: true, toolCalls: [] };
  updateSession(sessionId, current => ({ ...current, title: firstUserMessage ? text.slice(0, 50) : current.title, updatedAt: now, messages: [...current.messages, userMessage, assistantMessage] }));
  isStreaming.set(true);
  try {
    const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' }, body: JSON.stringify({ sessionId, agentId: session.agentId, content: text }) });
    if (!response.ok || !response.body) throw new Error(`Chat request failed (${response.status})`);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      while (buffer.includes('\n\n')) {
        const idx = buffer.indexOf('\n\n');
        const block = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        let eventName = 'message';
        const data = block.split('\n').reduce((acc, line) => {
          if (line.startsWith('event:')) eventName = line.slice(6).trim();
          if (line.startsWith('data:')) return `${acc}${acc ? '\n' : ''}${line.slice(5).trim()}`;
          return acc;
        }, '');
        if (!data) continue;
        if (data === '[DONE]') applyStreamEvent(sessionId, assistantId, 'done', {});
        else {
          try { applyStreamEvent(sessionId, assistantId, eventName, JSON.parse(data)); }
          catch { applyStreamEvent(sessionId, assistantId, eventName, { type: eventName, token: data }); }
        }
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown chat error';
    applyAssistantUpdate(sessionId, assistantId, msg => ({ ...msg, content: msg.content || `Error: ${message}`, isStreaming: false }));
  } finally {
    applyStreamEvent(sessionId, assistantId, 'done', {});
    isStreaming.set(false);
  }
}
function deleteSession(id: string): void {
  sessions.update(list => list.filter(session => session.id !== id));
  if (get(activeSessionId) === id) activeSessionId.set(get(sessions)[0]?.id ?? null);
}
function setActiveSession(id: string): void {
  if (get(sessions).some(session => session.id === id)) activeSessionId.set(id);
}
function normalizeMessage(value: unknown): ChatMessage | null {
  if (!isRecord(value)) return null;
  const role = toString(value.role);
  const toolCalls = Array.isArray(value.toolCalls) ? value.toolCalls.map(parseToolCall).filter((call): call is ToolCall => Boolean(call)) : undefined;
  return { id: toString(value.id) || crypto.randomUUID(), role: role === 'assistant' || role === 'system' ? role : 'user', content: toString(value.content), timestamp: toNumber(value.timestamp), isStreaming: Boolean(value.isStreaming), toolCalls };
}
function normalizeSession(value: unknown): ChatSession | null {
  if (!isRecord(value)) return null;
  const messages = Array.isArray(value.messages) ? value.messages.map(normalizeMessage).filter((m): m is ChatMessage => Boolean(m)) : [];
  return { id: toString(value.id) || crypto.randomUUID(), title: toString(value.title) || 'New Chat', agentId: typeof value.agentId === 'string' ? value.agentId : null, messages, createdAt: toNumber(value.createdAt), updatedAt: toNumber(value.updatedAt) };
}
function loadFromStorage(): void {
  if (!browser) return;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || !Array.isArray(parsed.sessions)) return;
    const restored = parsed.sessions.map(normalizeSession).filter((session): session is ChatSession => Boolean(session));
    sessions.set(restored);
    const selectedId = typeof parsed.activeSessionId === 'string' ? parsed.activeSessionId : null;
    activeSessionId.set(restored.some(session => session.id === selectedId) ? selectedId : restored[0]?.id ?? null);
  } catch {
    /* ignore malformed storage */
  }
}
function saveToStorage(): void {
  if (browser) localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessions: get(sessions), activeSessionId: get(activeSessionId) }));
}
if (browser) {
  loadFromStorage();
  let hydrated = false;
  sessions.subscribe(() => hydrated && saveToStorage());
  activeSessionId.subscribe(() => hydrated && saveToStorage());
  hydrated = true;
}
export const chatStore = {
  subscribe: sessions.subscribe,
  sessions,
  activeSessionId,
  isStreaming,
  activeSession,
  activeMessages,
  createSession,
  sendMessage,
  deleteSession,
  setActiveSession,
  loadFromStorage,
  saveToStorage
};
